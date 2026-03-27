import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, ArrowRight, MapPin, Calendar, Users, Loader2, Bot } from "lucide-react";
import { LocationPanel } from "@/components/search/LocationPanel";
import { DateSelector } from "@/components/search/DateSelector";

type Coords = { lat: number; lng: number };

type Step =
  | "intro"
  | "from"
  | "to"
  | "date"
  | "passengers"
  | "confirm";

interface State {
  step: Step;
  from: string;
  fromCoords: Coords | null;
  to: string;
  toCoords: Coords | null;
  date: Date | undefined;
  passengers: number;
}

const INITIAL_STATE: State = {
  step: "intro",
  from: "",
  fromCoords: null,
  to: "",
  toCoords: null,
  date: undefined,
  passengers: 1,
};

export function BookingAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [showPanel, setShowPanel] = useState<"from" | "to" | "date" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPanel(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const update = (patch: Partial<State>) =>
    setState((s) => ({ ...s, ...patch }));

  const handleOpen = () => {
    setOpen(true);
    setState(INITIAL_STATE);
  };

  const handleClose = () => {
    setOpen(false);
    setState(INITIAL_STATE);
    setShowPanel(null);
  };

  const handleSearch = () => {
    if (!state.fromCoords || !state.toCoords) return;
    const params = new URLSearchParams({
      from: state.from,
      fromLat: state.fromCoords.lat.toString(),
      fromLng: state.fromCoords.lng.toString(),
      to: state.to,
      toLat: state.toCoords.lat.toString(),
      toLng: state.toCoords.lng.toString(),
      passengers: state.passengers.toString(),
    });
    if (state.date) {
      const d = state.date;
      const dateStr = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
      params.append("date", dateStr);
    }
    handleClose();
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50" ref={containerRef}>
      {/* Panel overlay for dropdowns */}
      {showPanel && (
        <div
          className="fixed inset-0 bg-background/70 z-40"
          onClick={() => setShowPanel(null)}
        />
      )}

      {/* Chat window */}
      {open && (
        <div className="absolute bottom-14 right-0 w-80 bg-card border border-border shadow-lg rounded-sm overflow-visible mb-1 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Booking Assistant</span>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {state.step === "intro" && (
              <>
                <Bubble>
                  Hey! I can help you find a ride. Let's start — where are you departing from?
                </Bubble>
                <button
                  onClick={() => { update({ step: "from" }); setShowPanel("from"); }}
                  className="w-full flex items-center gap-2 h-10 px-3 border border-border rounded-sm text-sm text-muted-foreground hover:bg-accent transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Pick starting location</span>
                </button>
              </>
            )}

            {state.step === "from" && (
              <>
                <Bubble>Great — where are you departing from?</Bubble>
                <button
                  onClick={() => setShowPanel("from")}
                  className={`w-full flex items-center gap-2 h-10 px-3 border rounded-sm text-sm transition-colors ${
                    state.from
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{state.from || "Search origin…"}</span>
                </button>
                {state.from && (
                  <button
                    onClick={() => update({ step: "to" })}
                    className="w-full h-9 bg-primary text-primary-foreground text-sm rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    Continue <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}

            {state.step === "to" && (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate font-medium text-foreground">{state.from}</span>
                </div>
                <Bubble>Now, where are you heading?</Bubble>
                <button
                  onClick={() => setShowPanel("to")}
                  className={`w-full flex items-center gap-2 h-10 px-3 border rounded-sm text-sm transition-colors ${
                    state.to
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{state.to || "Search destination…"}</span>
                </button>
                {state.to && (
                  <button
                    onClick={() => update({ step: "date" })}
                    className="w-full h-9 bg-primary text-primary-foreground text-sm rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    Continue <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}

            {state.step === "date" && (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground truncate">{state.from}</span>
                  <span>→</span>
                  <span className="font-medium text-foreground truncate">{state.to}</span>
                </div>
                <Bubble>When do you want to travel?</Bubble>
                <button
                  onClick={() => setShowPanel("date")}
                  className={`w-full flex items-center gap-2 h-10 px-3 border rounded-sm text-sm transition-colors ${
                    state.date
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    {state.date
                      ? state.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "Select date (optional)"}
                  </span>
                </button>
                <button
                  onClick={() => update({ step: "passengers" })}
                  className="w-full h-9 bg-primary text-primary-foreground text-sm rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  {state.date ? "Continue" : "Skip (any date)"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {state.step === "passengers" && (
              <>
                <Bubble>How many passengers?</Bubble>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => update({ passengers: Math.max(1, state.passengers - 1) })}
                    className="h-9 w-9 border border-border rounded-sm hover:bg-accent transition-colors flex items-center justify-center"
                  >–</button>
                  <div className="flex items-center gap-2 text-lg font-bold tabular-nums">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {state.passengers}
                  </div>
                  <button
                    onClick={() => update({ passengers: Math.min(7, state.passengers + 1) })}
                    className="h-9 w-9 border border-border rounded-sm hover:bg-accent transition-colors flex items-center justify-center"
                  >+</button>
                </div>
                <button
                  onClick={() => update({ step: "confirm" })}
                  className="w-full h-9 bg-primary text-primary-foreground text-sm rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {state.step === "confirm" && (
              <>
                <Bubble>Here's your trip summary:</Bubble>
                <div className="p-3 bg-muted/40 border border-border rounded-sm space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">{state.from}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{state.to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>
                      {state.date
                        ? state.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "Any date"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>{state.passengers} passenger{state.passengers !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <button
                  onClick={handleSearch}
                  className="w-full h-9 bg-primary text-primary-foreground text-sm rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  Find Rides <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setState(INITIAL_STATE)}
                  className="w-full h-7 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Start over
                </button>
              </>
            )}
          </div>

          {/* Location Panel - rendered inside the widget */}
          {showPanel === "from" && (
            <div className="relative z-50">
              <LocationPanel
                type="from"
                onSelect={(loc, coords) => {
                  update({ from: loc, fromCoords: coords, step: "from" });
                  setShowPanel(null);
                }}
                onClose={() => setShowPanel(null)}
              />
            </div>
          )}
          {showPanel === "to" && (
            <div className="relative z-50">
              <LocationPanel
                type="to"
                onSelect={(loc, coords) => {
                  update({ to: loc, toCoords: coords, step: "to" });
                  setShowPanel(null);
                }}
                onClose={() => setShowPanel(null)}
              />
            </div>
          )}
          {showPanel === "date" && (
            <div className="relative z-50">
              <DateSelector
                selected={state.date}
                onSelect={(d) => {
                  update({ date: d });
                  setShowPanel(null);
                }}
                onClose={() => setShowPanel(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={open ? handleClose : handleOpen}
        className={`h-12 w-12 rounded-full flex items-center justify-center shadow-md transition-all ${
          open
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground hover:opacity-90"
        }`}
        aria-label={open ? "Close booking assistant" : "Open booking assistant"}
      >
        {open
          ? <X className="h-5 w-5" />
          : <MessageCircle className="h-5 w-5" />
        }
      </button>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
        <Bot className="h-3 w-3 text-primary" />
      </div>
      <p className="text-sm text-foreground leading-relaxed">{children}</p>
    </div>
  );
}
