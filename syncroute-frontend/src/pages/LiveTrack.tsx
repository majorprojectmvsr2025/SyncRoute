import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { liveTrackingAPI } from "@/lib/api";
import { 
  MapPin, 
  Clock, 
  Navigation, 
  User,
  Car,
  AlertTriangle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TrackingData {
  currentLocation?: {
    type: string;
    coordinates: number[];
  };
  eta?: {
    destination: string;
    estimatedArrival: string;
    distanceRemaining: number;
    durationRemaining: number;
  };
  progress: number;
  ride: {
    from: { name: string };
    to: { name: string };
    date: string;
    departureTime: string;
    vehicleType: string;
    vehicleModel?: string;
    driver: {
      name: string;
      photo?: string;
    };
  };
  sharedBy: {
    name: string;
    photo?: string;
  };
  startedAt: string;
  lastUpdatedAt: string;
  routePath?: {
    type: string;
    coordinates: number[][];
  };
}

export default function LiveTrack() {
  const { token } = useParams<{ token: string }>();
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (token) {
      loadTracking();
      const interval = setInterval(loadTracking, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [token]);

  const loadTracking = async () => {
    if (!token) return;
    
    try {
      const data = await liveTrackingAPI.getPublicTracking(token);
      setTracking(data);
      setLastUpdate(new Date());
      setError(null);
      
      // Update map marker position
      if (data.currentLocation?.coordinates && mapInstanceRef.current && markerRef.current) {
        const [lng, lat] = data.currentLocation.coordinates;
        markerRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 1 });
      }
    } catch (err: any) {
      if (err.response?.status === 410) {
        setError("This tracking link has expired or been stopped.");
      } else if (err.response?.status === 404) {
        setError("Tracking link not found.");
      } else {
        console.error("Failed to load tracking:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Initialize map with Leaflet
  useEffect(() => {
    if (!tracking?.currentLocation?.coordinates || !mapRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    const [lng, lat] = tracking.currentLocation.coordinates;

    // Create map
    const map = L.map(mapRef.current).setView([lat, lng], 14);
    mapInstanceRef.current = map;

    // Add tile layer (CartoDB)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(map);

    // Add route polyline if available
    if (tracking.routePath?.coordinates) {
      const routeCoords = tracking.routePath.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      routeLayerRef.current = L.polyline(routeCoords, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.6
      }).addTo(map);
    }

    // Create pulsing marker icon
    const pulsingIcon = L.divIcon({
      className: "live-location-marker",
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          position: relative;
        ">
          <div style="
            position: absolute;
            inset: -6px;
            border: 2px solid #22c55e;
            border-radius: 50%;
            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
            opacity: 0.3;
          "></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    // Add marker
    markerRef.current = L.marker([lat, lng], { icon: pulsingIcon }).addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [tracking?.currentLocation?.coordinates]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const openInMaps = () => {
    if (!tracking?.currentLocation?.coordinates) return;
    const [lng, lat] = tracking.currentLocation.coordinates;
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading live location...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Link Unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!tracking) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </div>
            <div>
              <h1 className="font-semibold">Live Location</h1>
              <p className="text-xs text-muted-foreground">
                Shared by {tracking.sharedBy.name}
              </p>
            </div>
            {lastUpdate && (
              <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="h-[50vh] bg-muted" />

      {/* Info Panel */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* ETA Card */}
        {tracking.eta && (
          <div className="bg-primary/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">Estimated Arrival</span>
              <span className="text-xs text-muted-foreground">
                {formatDistance(tracking.eta.distanceRemaining)} remaining
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {format(new Date(tracking.eta.estimatedArrival), "HH:mm")}
              </span>
              <span className="text-muted-foreground">
                ({formatDuration(tracking.eta.durationRemaining)})
              </span>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Trip Progress</span>
            <span className="font-medium">{tracking.progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${tracking.progress}%` }}
            />
          </div>
        </div>

        {/* Route info */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Ride Details</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2 shrink-0" />
              <div>
                <p className="font-medium">{tracking.ride.from.name}</p>
                <p className="text-xs text-muted-foreground">Pickup</p>
              </div>
            </div>
            <div className="ml-[3px] w-0.5 h-4 bg-border" />
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
              <div>
                <p className="font-medium">{tracking.ride.to.name}</p>
                <p className="text-xs text-muted-foreground">Drop-off</p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver info */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Driver</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              {tracking.ride.driver.photo ? (
                <img 
                  src={tracking.ride.driver.photo} 
                  alt={tracking.ride.driver.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">{tracking.ride.driver.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />
                {tracking.ride.vehicleModel || tracking.ride.vehicleType}
              </p>
            </div>
          </div>
        </div>

        {/* Open in Maps button */}
        <button
          onClick={openInMaps}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Google Maps
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by SyncRoute • Live location updates every 5-10 seconds
        </p>
      </div>

      {/* Ping animation styles */}
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .live-location-marker {
          background: transparent;
          border: none;
        }
      `}</style>
    </div>
  );
}
