import { useState, useEffect } from "react";
import { Search, MapPin, Loader2, Building2, Navigation, Train, Plane, Bus, X, GraduationCap, Heart } from "lucide-react";
import { searchLocations, formatLocationName, getLocationType, type LocationSuggestion } from "@/lib/geocoding";

interface LocationPanelProps {
  type: "from" | "to";
  onSelect: (location: string, coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

const POPULAR_CITIES = [
  "Hyderabad", "Bangalore", "Mumbai", "Delhi", "Chennai", "Pune", "Kolkata", "Ahmedabad",
  "Secunderabad", "Vizag", "Warangal", "Vijayawada",
];

export function LocationPanel({ type, onSelect, onClose }: LocationPanelProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
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
    }, 250);

    return () => clearTimeout(searchTimer);
  }, [query]);

  const handleSelect = (suggestion: LocationSuggestion) => {
    const displayName = formatLocationName(suggestion);
    onSelect(displayName, {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon)
    });
  };

  const getLocationIcon = (locationType: string) => {
    switch (locationType) {
      case "Station": return <Train className="h-4 w-4" />;
      case "Airport": return <Plane className="h-4 w-4" />;
      case "Bus Stop": return <Bus className="h-4 w-4" />;
      case "Education": return <GraduationCap className="h-4 w-4" />;
      case "Hospital": return <Heart className="h-4 w-4" />;
      case "City":
      case "Area":
      case "Place": return <Building2 className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 border border-border bg-card rounded-xl overflow-hidden shadow-lg">
      <div className="flex flex-col" style={{ maxHeight: "420px" }}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder={
              type === "from"
                ? "Search city, station, airport..."
                : "Where are you going?"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Popular cities
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {POPULAR_CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => setQuery(city)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {city}
                  </button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="px-4 py-10 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Searching places...</p>
            </div>
          ) : suggestions.length === 0 && searched ? (
            <div className="px-4 py-10 text-center">
              <MapPin className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No results for "{query}"
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try a different city name or spelling
              </p>
            </div>
          ) : (
            <div className="py-1">
              {suggestions.map((suggestion, index) => {
                const locationType = getLocationType(suggestion);
                const icon = getLocationIcon(locationType);
                const name = formatLocationName(suggestion);
                const subtitle = suggestion.display_name;

                return (
                  <button
                    key={`${suggestion.place_id}-${index}`}
                    onClick={() => handleSelect(suggestion)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-muted-foreground shrink-0">
                      {icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {subtitle}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider shrink-0">
                      {locationType}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
