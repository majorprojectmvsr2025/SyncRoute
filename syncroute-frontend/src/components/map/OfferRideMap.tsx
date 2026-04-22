import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer, TileLayer, Polyline, Marker, Popup, useMap,
} from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Loader2, Navigation, CheckCircle2 } from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

/* ── Types ─────────────────────────────────────────────── */
export interface OsrmRoute {
  coords: [number, number][];   // Leaflet [lat, lng]
  rawCoords: [number, number][]; // OSRM  [lng, lat] — to store in DB
  distance: number;              // metres
  duration: number;              // seconds
}

interface OfferRideMapProps {
  fromCoords: { lat: number; lng: number } | null;
  toCoords:   { lat: number; lng: number } | null;
  onFromChange?: (coords: { lat: number; lng: number }) => void;
  onToChange?:   (coords: { lat: number; lng: number }) => void;
  onRouteSelected?: (route: OsrmRoute) => void;
  height?: string;
}

/* ── Colours for up to 3 routes ───────────────────────── */
const ROUTE_COLORS = ["#2563eb", "#f59e0b", "#8b5cf6"];
const ROUTE_LABELS = ["Fastest", "Alternative", "Scenic"];

/* ── Dark-mode tile observer ──────────────────────────── */
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

/* ── Fit map to bounds ─────────────────────────────────── */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const prev = useRef<string>("");
  useEffect(() => {
    if (positions.length < 2) return;
    const key = JSON.stringify([positions[0], positions[positions.length - 1]]);
    if (key === prev.current) return;
    prev.current = key;
    map.fitBounds(positions, { padding: [48, 48] });
  }, [map, positions]);
  return null;
}

/* ── Pan to geo location once (only when no route coords are set) ── */
function SetViewOnGeo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const didSet = useRef(false);
  useEffect(() => {
    if (!didSet.current) {
      didSet.current = true;
      map.setView(center, zoom, { animate: true });
    }
  }, [map, center, zoom]);
  return null;
}

/* ── Draggable marker ──────────────────────────────────── */
function DraggableMarker({
  position, icon, label, onDragEnd,
}: {
  position: [number, number];
  icon: L.DivIcon;
  label: string;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  return (
    <Marker
      position={position}
      icon={icon}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const m = markerRef.current;
          if (m) {
            const { lat, lng } = m.getLatLng();
            onDragEnd(lat, lng);
          }
        },
      }}
    >
      <Popup className="text-xs">{label}</Popup>
    </Marker>
  );
}

/* ── Main component ────────────────────────────────────── */
export function OfferRideMap({
  fromCoords, toCoords, onFromChange, onToChange, onRouteSelected, height = "320px",
}: OfferRideMapProps) {
  const isDark = useIsDark();
  const [routes, setRoutes] = useState<OsrmRoute[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [fetching, setFetching] = useState(false);
  const fetchRef = useRef(0);

  // Geolocate user for initial map center
  const [geoCenter, setGeoCenter] = useState<[number, number] | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setGeoCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }, []);

  /* ── Fetch OSRM routes when coords change ── */
  useEffect(() => {
    if (!fromCoords || !toCoords) { setRoutes([]); return; }

    const id = ++fetchRef.current;
    setFetching(true);

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}` +
      `?overview=full&geometries=geojson&alternatives=true`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (id !== fetchRef.current) return;
        if (!data.routes?.length) { setRoutes([]); return; }

        const parsed: OsrmRoute[] = data.routes.slice(0, 3).map((r: any) => {
          const raw: [number, number][] = r.geometry.coordinates;  // [lng, lat]
          const leaflet: [number, number][] = raw.map(([lng, lat]) => [lat, lng]);
          return {
            coords: leaflet,
            rawCoords: raw,
            distance: r.distance,
            duration: r.duration,
          };
        });

        setRoutes(parsed);
        setSelectedIdx(0);
        onRouteSelected?.(parsed[0]);
      })
      .catch(() => {
        if (id === fetchRef.current) setRoutes([]);
      })
      .finally(() => {
        if (id === fetchRef.current) setFetching(false);
      });
  }, [fromCoords?.lat, fromCoords?.lng, toCoords?.lat, toCoords?.lng]);

  /* ── Notify parent when selection changes ── */
  const selectRoute = useCallback((idx: number) => {
    setSelectedIdx(idx);
    if (routes[idx]) onRouteSelected?.(routes[idx]);
  }, [routes, onRouteSelected]);

  /* ── Build icons ── */
  const fromIcon = L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#16a34a;border:3px solid white;
            box-shadow:0 2px 8px rgba(22,163,74,0.55);cursor:grab"></div>`,
    className: "", iconAnchor: [8, 8],
  });
  const toIcon = L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:3px;background:#dc2626;border:3px solid white;
            box-shadow:0 2px 8px rgba(220,38,38,0.55);cursor:grab"></div>`,
    className: "", iconAnchor: [8, 8],
  });

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  /* ── Choose bounds to fit ── */
  const fitPositions: [number, number][] =
    routes[selectedIdx]?.coords.length
      ? routes[selectedIdx].coords
      : fromCoords && toCoords
        ? [[fromCoords.lat, fromCoords.lng], [toCoords.lat, toCoords.lng]]
        : fromCoords ? [[fromCoords.lat, fromCoords.lng]]
        : toCoords   ? [[toCoords.lat,   toCoords.lng]]
        : [];

  const center: [number, number] = fromCoords
    ? [fromCoords.lat, fromCoords.lng]
    : geoCenter ?? [20.5937, 78.9629];

  // Zoom: fit route > single point (user geo or one coord) > country view
  const defaultZoom = (fromCoords && toCoords) ? 7
    : (fromCoords || toCoords) ? 12
    : geoCenter ? 12
    : 5;

  const fmtDist  = (m: number) => m > 999 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  const fmtDur   = (s: number) => {
    const adj = Math.round(s * 1.6 / 60);
    const h = Math.floor(adj / 60), m = adj % 60;
    return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      {/* ── Route selector strip (shown when >1 route available) ── */}
      {routes.length > 1 && (
        <div className="flex items-stretch divide-x divide-border border-b border-border bg-card">
          {routes.map((r, i) => (
            <button
              key={i}
              onClick={() => selectRoute(i)}
              className={`flex-1 flex flex-col items-center py-2.5 px-2 text-xs transition-colors ${
                selectedIdx === i
                  ? "bg-primary/5 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="h-2 w-6 rounded-full"
                  style={{ background: ROUTE_COLORS[i] }}
                />
                <span>{ROUTE_LABELS[i]}</span>
                {selectedIdx === i && <CheckCircle2 className="h-3 w-3 text-primary" />}
              </div>
              <div className="font-mono">
                {fmtDist(r.distance)} · {fmtDur(r.duration)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Map ── */}
      <div className="relative" style={{ height }}>
        {fetching && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[500] bg-background/90 backdrop-blur-sm
                          flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-border shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            Fetching routes…
          </div>
        )}

        <div className="absolute bottom-2 left-2 z-[400] flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-[10px] px-2 py-1 rounded border border-border">
            <span className="h-2 w-2 rounded-full bg-[#16a34a] inline-block" />
            Drag to adjust start
          </div>
          <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-[10px] px-2 py-1 rounded border border-border">
            <span className="h-2 w-2 rounded-sm bg-[#dc2626] inline-block" />
            Drag to adjust end
          </div>
        </div>

        <MapContainer
          center={center}
          zoom={defaultZoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            key={tileUrl}
            url={tileUrl}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={19}
          />

          {/* Draw all routes, dim non-selected ones */}
          {routes.map((r, i) =>
            i !== selectedIdx ? (
              <Polyline
                key={i}
                positions={r.coords}
                color={ROUTE_COLORS[i]}
                weight={3}
                opacity={0.35}
                dashArray="6 5"
                eventHandlers={{ click: () => selectRoute(i) }}
              />
            ) : null,
          )}
          {/* Selected route on top */}
          {routes[selectedIdx] && (
            <Polyline
              positions={routes[selectedIdx].coords}
              color={ROUTE_COLORS[selectedIdx]}
              weight={5}
              opacity={0.92}
            />
          )}

          {/* Draggable start marker */}
          {fromCoords && (
            <DraggableMarker
              position={[fromCoords.lat, fromCoords.lng]}
              icon={fromIcon}
              label="Start — drag to adjust"
              onDragEnd={(lat, lng) => onFromChange?.({ lat, lng })}
            />
          )}
          {/* Draggable end marker */}
          {toCoords && (
            <DraggableMarker
              position={[toCoords.lat, toCoords.lng]}
              icon={toIcon}
              label="End — drag to adjust"
              onDragEnd={(lat, lng) => onToChange?.({ lat, lng })}
            />
          )}

          {/* Auto-fit to route */}
          {fitPositions.length > 1 && <FitBounds positions={fitPositions} />}

          {/* Pan to user's location when geolocation resolves (no coords yet) */}
          {geoCenter && !fromCoords && !toCoords && (
            <SetViewOnGeo center={geoCenter} zoom={12} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
