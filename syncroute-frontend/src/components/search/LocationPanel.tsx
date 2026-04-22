import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2, Building2, Train, Plane, Bus, X, GraduationCap, Heart } from "lucide-react";
import { searchLocations, formatLocationName, getLocationType, type LocationSuggestion } from "@/lib/geocoding";

interface LocationPanelProps {
  type: "from" | "to";
  onSelect: (location: string, coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

const POPULAR_CITIES = [
  "Hyderabad", "Bangalore", "Mumbai", "Delhi",
  "Chennai", "Pune", "Kolkata", "Ahmedabad",
  "Secunderabad", "Vizag", "Warangal", "Vijayawada",
];

export function LocationPanel({ type, onSelect, onClose }: LocationPanelProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when panel opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        setSearched(true);
        const results = await searchLocations(query);
        setSuggestions(results);
        setLoading(false);
      } else {
        setSuggestions([]);
        setSearched(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (suggestion: LocationSuggestion) => {
    onSelect(formatLocationName(suggestion), {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
    });
  };

  const getIcon = (locationType: string) => {
    const cls = "h-4 w-4";
    switch (locationType) {
      case "Station":   return <Train className={cls} />;
      case "Airport":   return <Plane className={cls} />;
      case "Bus Stop":  return <Bus className={cls} />;
      case "Education": return <GraduationCap className={cls} />;
      case "Hospital":  return <Heart className={cls} />;
      default:          return <Building2 className={cls} />;
    }
  };

  return (
    /* This component is rendered inside a portal-like fixed container — no absolute positioning here */
    <div className="flex flex-col h-full">
      {/* Search input row */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border/40 shrink-0">
        <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={type === "from" ? "City, station, airport…" : "Where are you going?"}
          className="location-panel-input flex-1"
          style={{ border: "none", outline: "none", boxShadow: "none", background: "transparent" }}
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60 shrink-0" />}
        {query && !loading && (
          <button onClick={() => setQuery("")} className="text-muted-foreground/60 hover:text-foreground shrink-0 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {query.length < 2 ? (
          <div className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.18em] mb-3 px-1">
              Popular cities
            </p>
            <div className="grid grid-cols-3 gap-1">
              {POPULAR_CITIES.map(city => (
                <button
                  key={city}
                  onClick={() => setQuery(city)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="truncate font-medium">{city}</span>
                </button>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Searching…</p>
          </div>
        ) : suggestions.length === 0 && searched ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
            <MapPin className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No results for "{query}"</p>
            <p className="text-xs text-muted-foreground">Try a different spelling or nearby city</p>
          </div>
        ) : (
          <div className="py-1.5">
            {suggestions.map((s, i) => {
              const locType = getLocationType(s);
              const name = formatLocationName(s);
              return (
                <button
                  key={`${s.place_id}-${i}`}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/60 transition-all duration-150 group"
                >
                  <span className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0 group-hover:bg-background transition-colors">
                    {getIcon(locType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{s.display_name}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-wider shrink-0 hidden sm:block">
                    {locType}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
