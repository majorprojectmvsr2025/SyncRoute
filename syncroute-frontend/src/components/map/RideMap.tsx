import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

/* ── Dark mode observer ────────────────────────────────── */
function useIsDark() {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

/* ── Auto-fit bounds ───────────────────────────────────── */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const prev = useRef("");
  useEffect(() => {
    if (positions.length < 2) return;
    const key = JSON.stringify([positions[0], positions[positions.length - 1]]);
    if (key === prev.current) return;
    prev.current = key;
    map.fitBounds(positions, { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

/* ── Props ─────────────────────────────────────────────── */
interface RideMapProps {
  routeCoords: [number, number][];    // OSRM [lng, lat] — driver's route
  fromName: string;
  toName: string;
  matchedSegment?: [number, number][]; // OSRM [lng, lat]
  height?: string;
  userLocation?: [number, number];     // GPS [lat, lng]
  userPickup?: [number, number];       // [lat, lng] — search pickup
  userDrop?: [number, number];         // [lat, lng] — search drop
  /** Actual road route for user's pickup→drop, in Leaflet [lat,lng] pairs */
  userRoute?: [number, number][];
}

/* ── Component ─────────────────────────────────────────── */
export function RideMap({
  routeCoords, fromName, toName, matchedSegment,
  height = "280px", userLocation, userPickup, userDrop, userRoute,
}: RideMapProps) {
  const isDark = useIsDark();

  if (!routeCoords || routeCoords.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-muted border border-border rounded-lg text-xs text-muted-foreground">
        Map data unavailable
      </div>
    );
  }

  /* ── Coordinate conversion ── */
  const leafletCoords: [number, number][] = routeCoords.map(([lng, lat]) => [lat, lng]);
  const matchedLeaflet = matchedSegment?.map(([lng, lat]) => [lat, lng] as [number, number]);
  const startPoint = leafletCoords[0];
  const endPoint   = leafletCoords[leafletCoords.length - 1];

  /* ── Bounds (include user points) ── */
  const allPositions: [number, number][] = [...leafletCoords];
  if (userPickup) allPositions.push(userPickup);
  if (userDrop)   allPositions.push(userDrop);
  if (userRoute?.length)   allPositions.push(...userRoute);

  /* ── Icons ── */
  const startIcon = L.divIcon({
    html: `<div style="width:13px;height:13px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.5)"></div>`,
    className: "", iconAnchor: [6, 6],
  });
  const endIcon = L.divIcon({
    html: `<div style="width:13px;height:13px;border-radius:3px;background:${isDark ? "#f8fafc" : "#1e293b"};border:2.5px solid ${isDark ? "#334155" : "white"};box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    className: "", iconAnchor: [6, 6],
  });
  const pickupIcon = L.divIcon({
    html: `<div style="width:13px;height:13px;border-radius:50%;background:#16a34a;border:2.5px solid white;box-shadow:0 2px 8px rgba(22,163,74,0.5)"></div>`,
    className: "", iconAnchor: [6, 6],
  });
  const dropIcon = L.divIcon({
    html: `<div style="width:13px;height:13px;border-radius:3px;background:#16a34a;border:2.5px solid white;box-shadow:0 2px 8px rgba(22,163,74,0.5)"></div>`,
    className: "", iconAnchor: [6, 6],
  });

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const mapEl = (
    <MapContainer
      center={startPoint}
      zoom={8}
      style={{ height, width: "100%" }}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />

      {/* Driver route — solid blue */}
      <Polyline positions={leafletCoords} color="#2563eb" weight={4} opacity={0.88} />

      {/* Matched segment override */}
      {matchedLeaflet && matchedLeaflet.length > 1 && (
        <Polyline positions={matchedLeaflet} color="#0ea5e9" weight={5} opacity={0.95} />
      )}

      {/* Driver start/end markers */}
      <Marker position={startPoint} icon={startIcon}>
        <Popup className="text-xs">{fromName || "Origin"}</Popup>
      </Marker>
      <Marker position={endPoint} icon={endIcon}>
        <Popup className="text-xs">{toName || "Destination"}</Popup>
      </Marker>

      {/* User GPS location */}
      {userLocation && (
        <Circle
          center={userLocation}
          radius={120}
          pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.75, weight: 2 }}
        >
          <Popup className="text-xs">Your Location</Popup>
        </Circle>
      )}

      {/* User's search route — actual road polyline (green) */}
      {userRoute && userRoute.length > 1 && (
        <Polyline positions={userRoute} color="#16a34a" weight={3.5} opacity={0.8} dashArray="10 6" />
      )}

      {/* User pickup/drop markers */}
      {userPickup && (
        <Marker position={userPickup} icon={pickupIcon}>
          <Popup className="text-xs">Your Pickup</Popup>
        </Marker>
      )}
      {userDrop && (
        <Marker position={userDrop} icon={dropIcon}>
          <Popup className="text-xs">Your Drop-off</Popup>
        </Marker>
      )}

      <FitBounds positions={allPositions} />
    </MapContainer>
  );

  return (
    <div className="relative rounded-lg overflow-hidden border border-border" style={{ height }}>
      {mapEl}
    </div>
  );
}
