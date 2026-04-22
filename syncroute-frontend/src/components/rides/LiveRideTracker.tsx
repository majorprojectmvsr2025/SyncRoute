/**
 * LiveRideTracker — Ola/Uber-style live map for ongoing rides.
 * Shows the driver's moving position on the route, ETA, SOS button,
 * and passenger check-in status.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { liveTrackingAPI, sosAPI, bookingsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Navigation, AlertTriangle, MessageSquare, X,
  Phone, CheckCircle2, Clock, MapPin, Loader2,
  Shield, ChevronDown, ChevronUp, Users
} from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LiveRideTrackerProps {
  rideId: string;
  bookingId?: string;
  isDriver: boolean;
  fromName: string;
  toName: string;
  routeCoords?: [number, number][]; // [lng, lat] OSRM format
  driverName?: string;
  vehicleInfo?: string;
  passengers?: Array<{ _id: string; name: string; photo?: string; status: string }>;
  onClose?: () => void;
}

function useIsDark() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function LiveRideTracker({
  rideId, bookingId, isDriver,
  fromName, toName, routeCoords,
  driverName, vehicleInfo, passengers = [],
  onClose,
}: LiveRideTrackerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDark = useIsDark();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const trackingTokenRef = useRef<string | null>(null);

  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [elapsedMin, setElapsedMin] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosInfo, setSosInfo] = useState("");
  const [sosSent, setSosSent] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [passengerChecks, setPassengerChecks] = useState<Record<string, boolean>>({});
  const startTimeRef = useRef<number>(Date.now());

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsedMin(Math.floor((Date.now() - startTimeRef.current) / 60000));
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const center: [number, number] = routeCoords?.length
      ? [routeCoords[0][1], routeCoords[0][0]]
      : [17.385, 78.486]; // Hyderabad default

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(center, 14);
    mapInstanceRef.current = map;

    L.tileLayer(
      isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 }
    ).addTo(map);

    // Draw route
    if (routeCoords && routeCoords.length > 1) {
      const leaflet = routeCoords.map(([lng, lat]) => [lat, lng] as [number, number]);
      routeLayerRef.current = L.polyline(leaflet, {
        color: "#3b82f6", weight: 5, opacity: 0.7,
      }).addTo(map);

      // Start/end markers
      const startIcon = L.divIcon({
        html: `<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2.5px solid white;box-shadow:0 2px 6px rgba(34,197,94,0.5)"></div>`,
        className: "", iconAnchor: [6, 6],
      });
      const endIcon = L.divIcon({
        html: `<div style="width:12px;height:12px;border-radius:3px;background:#ef4444;border:2.5px solid white;box-shadow:0 2px 6px rgba(239,68,68,0.5)"></div>`,
        className: "", iconAnchor: [6, 6],
      });
      L.marker(leaflet[0], { icon: startIcon }).addTo(map);
      L.marker(leaflet[leaflet.length - 1], { icon: endIcon }).addTo(map);

      map.fitBounds(leaflet, { padding: [40, 40] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Car marker icon
  const getCarIcon = useCallback((hdg: number) => L.divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:${isDark ? "#1e293b" : "#fff"};
      border:2.5px solid #3b82f6;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(59,130,246,0.4);
      transform:rotate(${hdg}deg);
      transition:transform 0.5s ease;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L8 8H4l2 4H4l2 4h4l2 4 2-4h4l2-4h-2l2-4h-4L12 2z"/>
      </svg>
    </div>`,
    className: "", iconAnchor: [18, 18],
  }), [isDark]);

  // Start GPS tracking
  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    try {
      // Start backend session
      const session = await liveTrackingAPI.startTracking(rideId, bookingId);
      trackingTokenRef.current = session.trackingToken;
      setIsTracking(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng, heading: hdg, speed: spd } = pos.coords;
          setCurrentPos([lat, lng]);
          if (hdg !== null) setHeading(hdg);
          if (spd !== null) setSpeed(Math.round(spd * 3.6)); // m/s → km/h

          // Update map marker
          if (mapInstanceRef.current) {
            if (!carMarkerRef.current) {
              carMarkerRef.current = L.marker([lat, lng], { icon: getCarIcon(hdg || 0) })
                .addTo(mapInstanceRef.current);
            } else {
              carMarkerRef.current.setLatLng([lat, lng]);
              carMarkerRef.current.setIcon(getCarIcon(hdg || 0));
            }
            mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.8 });
          }

          // Update backend
          if (trackingTokenRef.current) {
            try {
              await liveTrackingAPI.updateLocation(trackingTokenRef.current, lat, lng, {
                accuracy: pos.coords.accuracy,
                speed: spd || undefined,
                heading: hdg || undefined,
              });
            } catch { /* silent */ }
          }
        },
        (err) => {
          console.error("GPS error:", err);
          toast.error("Could not get location. Check GPS permissions.");
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } catch (err) {
      toast.error("Failed to start tracking");
    }
  }, [rideId, bookingId, getCarIcon]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (trackingTokenRef.current) {
      try { await liveTrackingAPI.stopTracking(trackingTokenRef.current); } catch { /* silent */ }
      trackingTokenRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    // Auto-start tracking when component mounts
    startTracking();
    return () => { stopTracking(); };
  }, []);

  const handleSOS = async () => {
    setSosLoading(true);
    try {
      await sosAPI.trigger(rideId, currentPos ? { lat: currentPos[0], lng: currentPos[1] } : undefined, sosInfo);
      setSosSent(true);
      toast.success("SOS alert sent to your emergency contacts!");
      setTimeout(() => setShowSOS(false), 3000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send SOS");
    } finally {
      setSosLoading(false);
    }
  };

  const togglePassengerCheck = (passengerId: string) => {
    setPassengerChecks(prev => ({ ...prev, [passengerId]: !prev[passengerId] }));
  };

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-background">
      {/* Map */}
      <div ref={mapRef} className="flex-1 relative" style={{ minHeight: collapsed ? 0 : "60vh" }}>
        {/* Live badge */}
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 px-3 py-1.5 bg-background/90 backdrop-blur-sm rounded-full border border-border shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          <span className="text-xs font-semibold text-foreground">LIVE</span>
          {speed > 0 && <span className="text-xs text-muted-foreground">{speed} km/h</span>}
        </div>

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-[1000] h-8 w-8 bg-background/90 backdrop-blur-sm rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute bottom-3 right-3 z-[1000] h-8 px-3 bg-background/90 backdrop-blur-sm rounded-full border border-border flex items-center gap-1.5 text-xs font-medium hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {collapsed ? "Show map" : "Hide map"}
        </button>
      </div>

      {/* Bottom panel */}
      <div className="bg-card border-t border-border flex flex-col" style={{ maxHeight: "45vh", overflowY: "auto" }}>
        {/* Route header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {isDriver ? "You're driving" : "Ride in progress"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {elapsedMin > 0 ? `${elapsedMin}m elapsed` : "Just started"}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-success shrink-0" />
            <span className="text-muted-foreground truncate">{fromName}</span>
            <span className="text-muted-foreground">→</span>
            <div className="h-2 w-2 rounded-full bg-destructive shrink-0" />
            <span className="text-muted-foreground truncate">{toName}</span>
          </div>
        </div>

        {/* Driver: passenger checklist */}
        {isDriver && passengers.length > 0 && (
          <div className="px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passengers on board</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {passengers.map(p => (
                <button
                  key={p._id}
                  onClick={() => togglePassengerCheck(p._id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    passengerChecks[p._id]
                      ? "bg-success/10 text-success border border-success/20"
                      : "bg-muted text-muted-foreground border border-border hover:border-border/80"
                  }`}
                >
                  {passengerChecks[p._id]
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <div className="h-3.5 w-3.5 rounded-full border-2 border-current" />
                  }
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 py-3 flex gap-2">
          {/* Chat */}
          <button
            onClick={() => navigate(`/chat?rideId=${rideId}`)}
            className="flex-1 h-10 flex items-center justify-center gap-2 text-sm font-medium border border-border/60 rounded-xl hover:bg-accent active:scale-95 transition-all duration-150"
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>

          {/* Tracking toggle */}
          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`flex-1 h-10 flex items-center justify-center gap-2 text-sm font-medium rounded-xl active:scale-95 transition-all duration-150 ${
              isTracking
                ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                : "bg-muted text-muted-foreground border border-border hover:bg-accent"
            }`}
          >
            {isTracking ? (
              <><Navigation className="h-4 w-4 animate-pulse" /> Sharing</>
            ) : (
              <><Navigation className="h-4 w-4" /> Share location</>
            )}
          </button>

          {/* SOS */}
          <button
            onClick={() => setShowSOS(true)}
            className="h-10 w-10 flex items-center justify-center bg-destructive/10 text-destructive border border-destructive/20 rounded-xl hover:bg-destructive/20 active:scale-95 transition-all duration-150"
            title="SOS Emergency"
          >
            <Shield className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* SOS Modal */}
      {showSOS && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            {sosSent ? (
              <div className="text-center py-4">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                <h3 className="font-semibold text-lg text-foreground mb-1">SOS Sent</h3>
                <p className="text-sm text-muted-foreground">Your emergency contacts have been alerted with your location.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Emergency SOS</h3>
                    <p className="text-xs text-muted-foreground">Alert will be sent with your GPS location</p>
                  </div>
                  <button onClick={() => setShowSOS(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {currentPos && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-success/10 rounded-lg text-xs text-success">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>GPS location detected — will be included</span>
                  </div>
                )}

                <div className="mb-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Additional info (optional)
                  </label>
                  <textarea
                    value={sosInfo}
                    onChange={e => setSosInfo(e.target.value)}
                    placeholder="Describe the situation..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-background border border-border/50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive/40 transition-all"
                  />
                </div>

                {driverName && (
                  <div className="mb-4 px-3 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                    <span className="font-medium">Ride info:</span> {driverName} · {vehicleInfo || "Vehicle"}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSOS(false)}
                    className="flex-1 h-10 border border-border/60 rounded-xl text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSOS}
                    disabled={sosLoading}
                    className="flex-1 h-10 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sosLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                    Send SOS
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveRideTracker;
