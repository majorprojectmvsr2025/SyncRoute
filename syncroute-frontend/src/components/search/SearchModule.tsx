import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Calendar, Clock, Users, Search, ArrowRightLeft } from "lucide-react";
import { LocationPanel } from "./LocationPanel";
import { DateSelector } from "./DateSelector";
import { TimeSelector } from "./TimeSelector";
import { PassengerSelector } from "./PassengerSelector";

interface SearchModuleProps {
  initialFrom?: string;
  initialFromCoords?: { lat: number; lng: number } | null;
  initialTo?: string;
  initialToCoords?: { lat: number; lng: number } | null;
  initialDate?: string; // YYYY-MM-DD
  initialPassengers?: number;
  onSearch?: () => void;
  compact?: boolean;
}

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function SearchModule({
  initialFrom,
  initialFromCoords,
  initialTo,
  initialToCoords,
  initialDate,
  initialPassengers,
  onSearch,
  compact = false,
}: SearchModuleProps = {}) {
  const navigate = useNavigate();
  const [from, setFrom] = useState(initialFrom || "");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(initialFromCoords || null);
  const [to, setTo] = useState(initialTo || "");
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(initialToCoords || null);
  const [date, setDate] = useState<Date | undefined>(initialDate ? parseLocalDate(initialDate) : undefined);
  const [time, setTime] = useState("");
  const [passengers, setPassengers] = useState(initialPassengers || 1);

  const [activePanel, setActivePanel] = useState<"from" | "to" | "date" | "time" | "passengers" | null>(null);

  const handleSearch = () => {
    if (!from || !to || !fromCoords || !toCoords) {
      alert("Please select both origin and destination");
      return;
    }

    const params = new URLSearchParams({
      from,
      fromLat: fromCoords.lat.toString(),
      fromLng: fromCoords.lng.toString(),
      to,
      toLat: toCoords.lat.toString(),
      toLng: toCoords.lng.toString(),
      passengers: passengers.toString(),
    });

    if (date) {
      const localDate = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
      params.append("date", localDate);
    }

    onSearch?.();
    navigate(`/search?${params.toString()}`);
  };

  const handleSwap = () => {
    const tmpFrom = from;
    const tmpFromCoords = fromCoords;
    setFrom(to);
    setFromCoords(toCoords);
    setTo(tmpFrom);
    setToCoords(tmpFromCoords);
  };

  const closePanel = () => setActivePanel(null);

  const fieldHeight = compact ? "h-14" : "h-16";

  return (
    <div className="relative">
      {/* Overlay */}
      {activePanel && (
        <div className="fixed inset-0 bg-background/60 z-30" onClick={closePanel} />
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm relative z-40">
        {/* Desktop layout */}
        <div className="hidden md:block">
          <div className="flex items-stretch">
            {/* FROM */}
            <button
              onClick={() => setActivePanel(activePanel === "from" ? null : "from")}
              className={`${fieldHeight} flex-1 min-w-0 flex items-center gap-3 px-5 text-left rounded-l-xl transition-colors ${
                activePanel === "from" ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <div className="shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">From</div>
                <div className={`text-sm font-medium truncate ${from ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {from || "Enter city or place"}
                </div>
              </div>
            </button>

            {/* Swap button */}
            <div className="flex items-center -mx-3 z-10">
              <button
                onClick={handleSwap}
                className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* TO */}
            <button
              onClick={() => setActivePanel(activePanel === "to" ? null : "to")}
              className={`${fieldHeight} flex-1 min-w-0 flex items-center gap-3 px-5 text-left border-l border-border transition-colors ${
                activePanel === "to" ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <div className="shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">To</div>
                <div className={`text-sm font-medium truncate ${to ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {to || "Enter city or place"}
                </div>
              </div>
            </button>

            {/* Divider */}
            <div className="w-px bg-border" />

            {/* DATE */}
            <button
              onClick={() => setActivePanel(activePanel === "date" ? null : "date")}
              className={`${fieldHeight} w-40 shrink-0 flex items-center gap-3 px-4 text-left transition-colors ${
                activePanel === "date" ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Date</div>
                <div className={`text-sm font-medium ${date ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Any date"}
                </div>
              </div>
            </button>

            {/* Divider */}
            <div className="w-px bg-border" />

            {/* PASSENGERS */}
            <button
              onClick={() => setActivePanel(activePanel === "passengers" ? null : "passengers")}
              className={`${fieldHeight} w-36 shrink-0 flex items-center gap-3 px-4 text-left transition-colors ${
                activePanel === "passengers" ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Passengers</div>
                <div className="text-sm font-medium text-foreground">
                  {passengers} {passengers === 1 ? "Passenger" : "Passengers"}
                </div>
              </div>
            </button>

            {/* SEARCH BUTTON */}
            <button
              onClick={handleSearch}
              className={`${fieldHeight} px-8 bg-foreground text-background flex items-center gap-2.5 text-sm font-semibold rounded-r-xl hover:bg-foreground/90 transition-colors shrink-0`}
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden">
          <div className="divide-y divide-border">
            {/* FROM */}
            <button
              onClick={() => setActivePanel(activePanel === "from" ? null : "from")}
              className={`w-full h-14 flex items-center gap-3 px-4 text-left transition-colors rounded-t-xl ${
                activePanel === "from" ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">From</div>
                <div className={`text-sm font-medium truncate ${from ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {from || "Enter city or place"}
                </div>
              </div>
              {from && to && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); handleSwap(); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleSwap(); } }}
                  className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground shrink-0 cursor-pointer"
                >
                  <ArrowRightLeft className="h-3 w-3" />
                </div>
              )}
            </button>

            {/* TO */}
            <button
              onClick={() => setActivePanel(activePanel === "to" ? null : "to")}
              className={`w-full h-14 flex items-center gap-3 px-4 text-left transition-colors ${
                activePanel === "to" ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">To</div>
                <div className={`text-sm font-medium truncate ${to ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {to || "Enter city or place"}
                </div>
              </div>
            </button>

            {/* DATE + PASSENGERS row */}
            <div className="flex divide-x divide-border">
              <button
                onClick={() => setActivePanel(activePanel === "date" ? null : "date")}
                className={`h-14 flex-1 flex items-center gap-2.5 px-4 text-left transition-colors ${
                  activePanel === "date" ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Date</div>
                  <div className={`text-sm font-medium ${date ? "text-foreground" : "text-muted-foreground/60"}`}>
                    {date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Any"}
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActivePanel(activePanel === "passengers" ? null : "passengers")}
                className={`h-14 w-32 shrink-0 flex items-center gap-2.5 px-4 text-left transition-colors ${
                  activePanel === "passengers" ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pax</div>
                  <div className="text-sm font-medium text-foreground">{passengers}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            className="w-full h-12 bg-foreground text-background flex items-center justify-center gap-2 text-sm font-semibold rounded-b-xl hover:bg-foreground/90 transition-colors"
          >
            <Search className="h-4 w-4" />
            Search rides
          </button>
        </div>
      </div>

      {/* Panels */}
      {(activePanel === "from" || activePanel === "to") && (
        <LocationPanel
          type={activePanel}
          onSelect={(loc, coords) => {
            if (activePanel === "from") {
              setFrom(loc);
              setFromCoords(coords);
            } else {
              setTo(loc);
              setToCoords(coords);
            }
            closePanel();
          }}
          onClose={closePanel}
        />
      )}
      {activePanel === "date" && (
        <DateSelector
          selected={date}
          onSelect={(d) => { setDate(d); closePanel(); }}
          onClose={closePanel}
        />
      )}
      {activePanel === "time" && (
        <TimeSelector
          selected={time}
          onSelect={(t) => { setTime(t); closePanel(); }}
          onClose={closePanel}
        />
      )}
      {activePanel === "passengers" && (
        <PassengerSelector
          value={passengers}
          onChange={setPassengers}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
