import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Users, Search, ArrowUpDown, X,
  ChevronLeft, ChevronRight, Minus, Plus, Mic
} from "lucide-react";
import { LocationPanel } from "./LocationPanel";

interface SearchModuleProps {
  initialFrom?: string;
  initialFromCoords?: { lat: number; lng: number } | null;
  initialTo?: string;
  initialToCoords?: { lat: number; lng: number } | null;
  initialDate?: string;
  initialPassengers?: number;
  onSearch?: () => void;
}

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type Panel = "from" | "to" | "date" | "passengers" | "voice" | null;

/* ─── Portal ────────────────────────────────────────────────────── */
// Uses element ID to find anchor, computes position fresh every time open=true.
// fixedWidth overrides the anchor's own width (needed for calendar: 308px > date button width).
// smartLeft: if true, tries to keep panel on-screen by shifting left when needed.
function Portal({
  anchorId,
  open,
  onClose,
  children,
  align = "left",
  fixedWidth,
}: {
  anchorId: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
  fixedWidth?: number;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) { setPos(null); return; }

    const calc = () => {
      const el = document.getElementById(anchorId);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = fixedWidth ?? r.width;
      let left = align === "right" ? r.right - w : r.left;
      left = Math.min(left, window.innerWidth - w - 8);
      left = Math.max(8, left);
      setPos({ top: r.bottom + 8, left, width: w });
    };

    calc();
    window.addEventListener("scroll", calc, true);
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc, true);
      window.removeEventListener("resize", calc);
    };
  }, [open, anchorId, align, fixedWidth]);

  if (!open || !pos) return null;

  const maxH = Math.max(400, Math.min(560, window.innerHeight - pos.top - 16));

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9990]" onClick={onClose} />
      <div
        className="portal-panel fixed z-[9999] flex flex-col"
        style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: maxH }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

/* ─── Calendar ─────────────────────────────────────────────────── */
function CalendarPicker({ selected, onSelect }: { selected?: Date; onSelect: (d: Date) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isPast = (d: number) => {
    const t = new Date(today); t.setHours(0, 0, 0, 0);
    return new Date(year, month, d) < t;
  };
  const isSel = (d: number) => selected?.toDateString() === new Date(year, month, d).toDateString();
  const isToday = (d: number) => new Date(year, month, d).toDateString() === today.toDateString();

  const prev = () => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const next = () => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1);

  const monthName = new Date(year, month).toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="p-5 select-none" style={{ width: 320 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prev}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground tracking-tight">{monthName}</span>
        <button
          onClick={next}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
          <div key={d} className="h-8 flex items-center justify-center text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => (
          <div key={i} className="flex items-center justify-center">
            {d ? (
              <button
                disabled={isPast(d)}
                onClick={() => onSelect(new Date(year, month, d))}
                className={`calendar-day-btn ${
                  isSel(d) ? "selected" :
                  isToday(d) ? "today" :
                  isPast(d) ? "" : ""
                }`}
              >
                {d}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Quick picks */}
      <div className="mt-4 pt-4 border-t border-border/50 flex gap-2">
        {[
          { label: "Today", date: new Date() },
          { label: "Tomorrow", date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })() },
          { label: "This weekend", date: (() => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? 6 : 6 - day; d.setDate(d.getDate() + diff); return d; })() },
        ].map(({ label, date: qd }) => (
          <button
            key={label}
            onClick={() => onSelect(qd)}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all duration-150 ${
              selected?.toDateString() === qd.toDateString()
                ? "bg-primary text-primary-foreground"
                : "bg-accent hover:bg-accent/70 text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Seat picker ──────────────────────────────────────────────── */
function SeatPicker({ value, onChange, onClose }: { value: number; onChange: (v: number) => void; onClose: () => void }) {
  return (
    <div className="p-5" style={{ width: 240 }}>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-5">Seats needed</p>
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          className="h-10 w-10 rounded-xl border border-border/60 flex items-center justify-center hover:bg-accent hover:border-border transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-5xl font-display font-bold text-foreground leading-none tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground mt-1.5 font-medium">{value === 1 ? "seat" : "seats"}</div>
        </div>
        <button
          onClick={() => onChange(Math.min(6, value + 1))}
          disabled={value >= 6}
          className="h-10 w-10 rounded-xl border border-border/60 flex items-center justify-center hover:bg-accent hover:border-border transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {/* Quick select dots */}
      <div className="flex justify-center gap-1.5 mb-5">
        {[1,2,3,4,5,6].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-7 w-7 rounded-lg text-xs font-bold transition-all duration-150 ${
              n === value
                ? "bg-primary text-primary-foreground scale-110"
                : "bg-accent hover:bg-accent/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="btn btn-primary btn-md w-full">Done</button>
    </div>
  );
}

/* ─── Voice search ─────────────────────────────────────────────── */
function VoiceSearch({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "listening" | "processing" | "done" | "error">("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [parsedInfo, setParsedInfo] = useState<{ from?: string; to?: string; date?: string; passengers?: number }>({});
  const [audioLevel, setAudioLevel] = useState(0);
  const recRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice search is not supported in this browser. Try Chrome or Edge.");
      setState("error");
      return;
    }

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 32;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        audioCtxRef.current = ctx;
        const tick = () => {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setAudioLevel(avg / 128);
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { /* mic access denied — waveform won't show */ }
    };

    const rec = new SpeechRecognition();
    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    recRef.current = rec;

    rec.onstart = () => { setState("listening"); setupAudio(); };
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setTranscript(t);
      const info = parseVoiceTranscript(t);
      setParsedInfo(info);
      if (e.results[e.results.length - 1].isFinal) {
        setState("processing");
        setTimeout(() => { setState("done"); onResult(t); }, 600);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed") setError("Microphone access denied. Please allow microphone in browser settings.");
      else if (e.error === "no-speech") setError("No speech detected. Please try again.");
      else setError("Could not understand. Please speak clearly and try again.");
      setState("error");
    };
    rec.onend = () => { if (state === "listening") setState("idle"); };
    rec.start();
    return () => {
      try { rec.stop(); } catch {}
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  const parseVoiceTranscript = (text: string) => {
    const lower = text.toLowerCase();
    const info: any = {};
    const toIdx = lower.indexOf(" to ");
    if (toIdx > 0) {
      info.from = text.slice(0, toIdx).replace(/^from\s+/i, '').trim();
      info.to = text.slice(toIdx + 4).replace(/\b(tomorrow|today|for\s+\d+.*|on\s+\w+|\d+\s*(passenger|seat|people).*)/gi, '').trim();
    }
    if (lower.includes("tomorrow")) info.date = "Tomorrow";
    else if (lower.includes("today")) info.date = "Today";
    else { const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]; for (const d of days) if (lower.includes(d)) { info.date = d.charAt(0).toUpperCase() + d.slice(1); break; } }
    const pm = text.match(/(\d+)\s*(passenger|passengers|seat|seats|people)/i);
    if (pm) info.passengers = parseInt(pm[1]);
    return info;
  };

  // ChatGPT-style waveform bars
  const BAR_COUNT = 7;
  const barHeights = Array.from({ length: BAR_COUNT }, (_, i) => {
    if (state !== "listening") return state === "processing" ? 0.35 : 0.12;
    const center = (BAR_COUNT - 1) / 2;
    const distFromCenter = Math.abs(i - center) / center;
    return Math.max(0.12, audioLevel * (1 - distFromCenter * 0.4) + 0.12);
  });

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-5" style={{ minHeight: 300 }}>
      {/* Mic icon — bigger, centered */}
      <div className={`h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300 ${
        state === "listening" ? "bg-primary shadow-lg shadow-primary/30" :
        state === "done" ? "bg-success shadow-lg shadow-success/30" :
        state === "error" ? "bg-destructive/20" : "bg-muted"
      }`}
        style={state === "listening" ? { animation: "pulse 1.5s ease-in-out infinite" } : {}}
      >
        <Mic className={`h-9 w-9 ${
          state === "listening" || state === "processing" ? "text-primary-foreground" :
          state === "done" ? "text-success-foreground" : "text-muted-foreground"
        }`} />
      </div>

      {/* Waveform bars */}
      <div className="flex items-center justify-center gap-1.5 h-12">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${
              state === "listening" ? "bg-primary" :
              state === "done" ? "bg-success" :
              state === "error" ? "bg-destructive/40" : "bg-muted-foreground/25"
            }`}
            style={{
              width: 5,
              height: `${Math.max(8, h * 48)}px`,
              transition: state === "listening" ? "height 0.1s ease" : "height 0.4s ease",
            }}
          />
        ))}
      </div>

      <div className="text-center w-full">
        <p className="font-semibold text-sm text-foreground mb-2">
          {state === "idle" ? "Starting…" : state === "listening" ? "Listening…" :
           state === "processing" ? "Processing…" : state === "done" ? "Got it!" : "Error"}
        </p>

        {transcript && state !== "error" && (
          <div className="mb-3 px-4 py-2.5 bg-accent/60 rounded-xl border border-border">
            <p className="text-sm text-foreground italic">"{transcript}"</p>
          </div>
        )}

        {(parsedInfo.from || parsedInfo.to || parsedInfo.date || parsedInfo.passengers) && state === "listening" && (
          <div className="mb-3 p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1 text-left">
            {parsedInfo.from && <div className="flex items-center gap-2 text-xs"><div className="h-2 w-2 rounded-full bg-success shrink-0" /><span className="text-muted-foreground">From:</span><span className="font-semibold text-foreground">{parsedInfo.from}</span></div>}
            {parsedInfo.to && <div className="flex items-center gap-2 text-xs"><div className="h-2 w-2 rounded-full bg-destructive shrink-0" /><span className="text-muted-foreground">To:</span><span className="font-semibold text-foreground">{parsedInfo.to}</span></div>}
            {parsedInfo.date && <div className="flex items-center gap-2 text-xs"><Calendar className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-muted-foreground">Date:</span><span className="font-semibold text-foreground">{parsedInfo.date}</span></div>}
            {parsedInfo.passengers && <div className="flex items-center gap-2 text-xs"><Users className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-muted-foreground">Passengers:</span><span className="font-semibold text-foreground">{parsedInfo.passengers}</span></div>}
          </div>
        )}

        {error && <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl"><p className="text-sm text-destructive">{error}</p></div>}

        {state === "listening" && !transcript && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Try: <span className="text-primary font-semibold">"Hyderabad to Gachibowli tomorrow 3 passengers"</span></p>
          </div>
        )}
      </div>

      <button onClick={onClose} className="btn btn-outline btn-sm px-6">
        {state === "error" ? "Close" : "Cancel"}
      </button>
    </div>
  );
}

/* ─── Main SearchModule ─────────────────────────────────────────── */
export function SearchModule({
  initialFrom, initialFromCoords, initialTo, initialToCoords,
  initialDate, initialPassengers, onSearch,
}: SearchModuleProps = {}) {
  const navigate = useNavigate();

  const [from, setFrom] = useState(initialFrom || "");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(initialFromCoords || null);
  const [to, setTo] = useState(initialTo || "");
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(initialToCoords || null);
  const [date, setDate] = useState<Date | undefined>(initialDate ? parseLocalDate(initialDate) : undefined);
  const [passengers, setPassengers] = useState(initialPassengers || 1);
  const [panel, setPanel] = useState<Panel>(null);

  const close = useCallback(() => setPanel(null), []);
  const toggle = (p: Panel) => setPanel(prev => prev === p ? null : p);

  const handleSearch = () => {
    if (!from || !to || !fromCoords || !toCoords) {
      alert("Please select both pickup and drop locations");
      return;
    }
    const params = new URLSearchParams({
      from, fromLat: String(fromCoords.lat), fromLng: String(fromCoords.lng),
      to,   toLat:   String(toCoords.lat),   toLng:   String(toCoords.lng),
      passengers: String(passengers),
    });
    if (date) {
      params.append("date", [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-"));
    }
    onSearch?.();
    navigate(`/search?${params.toString()}`);
  };

  const swap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const [tf, tc] = [from, fromCoords];
    setFrom(to); setFromCoords(toCoords);
    setTo(tf);   setToCoords(tc);
  };

  const fmtDate = (d?: Date) =>
    d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Any date";

  const active = (p: Panel) => panel === p;

  // Enhanced voice result parsing with geocoding validation
  const handleVoiceResult = async (text: string) => {
    const lower = text.toLowerCase().trim();
    
    // Extract passenger count FIRST before cleaning
    const passengerCount = extractPassengerCount(lower);
    if (passengerCount) {
      setPassengers(passengerCount);
    }
    
    // Extract date information
    const parsedDate = extractDateFromVoice(lower);
    if (parsedDate) {
      setDate(parsedDate);
    }

    // Remove passenger/date keywords from the full text before parsing locations
    const cleanedText = removeNonLocationWords(text);
    const cleanedLower = cleanedText.toLowerCase().trim();

    // Parse "from X to Y" or "X to Y"
    const toIdx = cleanedLower.indexOf(" to ");
    if (toIdx > 0) {
      let fromPart = cleanedText.slice(0, toIdx).trim();
      let toPart = cleanedText.slice(toIdx + 4).trim();

      // Strip leading "from " if present
      if (fromPart.toLowerCase().startsWith("from ")) {
        fromPart = fromPart.slice(5).trim();
      }

      // Final clean of each part
      fromPart = fromPart.trim();
      toPart = toPart.trim();

      // Geocode and validate locations
      if (fromPart) {
        const coords = await geocodeLocation(fromPart);
        if (coords) {
          setFrom(fromPart);
          setFromCoords(coords);
        } else {
          setFrom(fromPart);
        }
      }
      
      if (toPart) {
        const coords = await geocodeLocation(toPart);
        if (coords) {
          setTo(toPart);
          setToCoords(coords);
        } else {
          setTo(toPart);
        }
      }
    } else {
      // Single location
      const singleLoc = cleanedText.trim();
      if (singleLoc) {
        const coords = await geocodeLocation(singleLoc);
        if (!from) {
          setFrom(singleLoc);
          if (coords) setFromCoords(coords);
        } else if (!to) {
          setTo(singleLoc);
          if (coords) setToCoords(coords);
        } else {
          setFrom(singleLoc);
          if (coords) setFromCoords(coords);
        }
      }
    }
    close();
  };

  // Remove ALL non-location words from text before parsing locations
  const removeNonLocationWords = (text: string): string => {
    // Remove passenger/seat patterns like "5 passengers", "for 3 people", "3 seats"
    let cleaned = text.replace(/\b(for\s+)?\d+\s*(passenger|passengers|seat|seats|people|person|travell?er|travell?ers)\b/gi, '');
    // Remove date words
    cleaned = cleaned.replace(/\b(tomorrow|today|tonight|next\s+week|this\s+weekend|weekend)\b/gi, '');
    cleaned = cleaned.replace(/\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');
    // Remove time words
    cleaned = cleaned.replace(/\b(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '');
    // Remove "for" at end
    cleaned = cleaned.replace(/\bfor\s*$/gi, '');
    // Collapse multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };

  // Helper: Extract date from voice input
  const extractDateFromVoice = (text: string): Date | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (text.includes("today")) {
      return today;
    }
    
    if (text.includes("tomorrow")) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    
    // Day of week
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let i = 0; i < days.length; i++) {
      if (text.includes(days[i])) {
        const targetDay = i;
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
        const result = new Date(today);
        result.setDate(result.getDate() + daysToAdd);
        return result;
      }
    }
    
    // "next week"
    if (text.includes("next week")) {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
    
    // "this weekend" (Saturday)
    if (text.includes("weekend") || text.includes("saturday")) {
      const saturday = new Date(today);
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
      saturday.setDate(saturday.getDate() + daysUntilSaturday);
      return saturday;
    }
    
    return null;
  };

  // Helper: Extract passenger count from voice
  const extractPassengerCount = (text: string): number | null => {
    // Match patterns like "2 passengers", "3 seats", "for 4 people"
    const patterns = [
      /(\d+)\s*(passenger|passengers|seat|seats|people|person)/i,
      /for\s*(\d+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1]);
        if (count >= 1 && count <= 6) {
          return count;
        }
      }
    }
    
    return null;
  };

  // Helper: Geocode location using Nominatim
  const geocodeLocation = async (locationName: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}, India&limit=1`,
        { headers: { 'User-Agent': 'SyncRoute/1.0' } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  return (
    <div id="search-wrap">
      {/* ── DESKTOP ─────────────────────────────────────────── */}
      <div className="hidden md:flex bg-card border border-border/50 rounded-2xl shadow-md overflow-hidden"
        style={{ boxShadow: "0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.04)" }}>

        {/* FROM */}
        <div id="field-from" onClick={() => toggle("from")}
          className={`flex items-center gap-3 px-5 cursor-pointer select-none transition-all duration-150 flex-1 min-w-0 h-[64px] border-r border-border/40 rounded-l-2xl ${active("from") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
          <div className="h-2.5 w-2.5 rounded-full bg-success shrink-0 shadow-sm" style={{ boxShadow: "0 0 0 3px hsl(var(--success)/0.15)" }} />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] leading-none mb-1.5">Pickup</div>
            <div className={`text-[14px] font-semibold truncate leading-tight ${from ? "text-foreground" : "text-muted-foreground/40"}`}>
              {from || "Where are you starting?"}
            </div>
          </div>
          {from && (
            <button onClick={e => { e.stopPropagation(); setFrom(""); setFromCoords(null); }}
              className="h-5 w-5 rounded-full bg-muted/80 hover:bg-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* SWAP */}
        <div className="relative shrink-0 w-0 flex items-center justify-center z-10">
          <button onClick={swap}
            className="absolute h-7 w-7 bg-card border border-border/60 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all shadow-sm hover:shadow-md active:scale-95">
            <ArrowUpDown className="h-3 w-3" />
          </button>
        </div>

        {/* TO */}
        <div id="field-to" onClick={() => toggle("to")}
          className={`flex items-center gap-3 px-5 cursor-pointer select-none transition-all duration-150 flex-1 min-w-0 h-[64px] border-r border-border/40 ${active("to") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
          <div className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" style={{ boxShadow: "0 0 0 3px hsl(var(--destructive)/0.12)" }} />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] leading-none mb-1.5">Drop-off</div>
            <div className={`text-[14px] font-semibold truncate leading-tight ${to ? "text-foreground" : "text-muted-foreground/40"}`}>
              {to || "Where are you going?"}
            </div>
          </div>
          {to && (
            <button onClick={e => { e.stopPropagation(); setTo(""); setToCoords(null); }}
              className="h-5 w-5 rounded-full bg-muted/80 hover:bg-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* DATE */}
        <button id="field-date" onClick={() => toggle("date")}
          className={`flex items-center gap-3 px-5 cursor-pointer select-none transition-all duration-150 w-[152px] h-[64px] border-r border-border/40 shrink-0 ${active("date") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
          <Calendar className="h-4 w-4 text-muted-foreground/70 shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] leading-none mb-1.5">When</div>
            <div className={`text-[14px] font-semibold leading-tight ${date ? "text-foreground" : "text-muted-foreground/40"}`}>
              {fmtDate(date)}
            </div>
          </div>
        </button>

        {/* SEATS */}
        <button id="field-seats" onClick={() => toggle("passengers")}
          className={`flex items-center gap-3 px-5 cursor-pointer select-none transition-all duration-150 w-[120px] h-[64px] border-r border-border/40 shrink-0 ${active("passengers") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
          <Users className="h-4 w-4 text-muted-foreground/70 shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] leading-none mb-1.5">Travelers</div>
            <div className="text-[14px] font-semibold text-foreground leading-tight">{passengers} {passengers === 1 ? "seat" : "seats"}</div>
          </div>
        </button>

        {/* MIC */}
        <button
          onClick={() => setPanel("voice")}
          className={`h-[64px] w-[52px] flex items-center justify-center border-r border-border/40 shrink-0 transition-all duration-150 ${
            panel === "voice" ? "bg-primary/[0.04]" : "hover:bg-accent/40"
          } text-muted-foreground/70 hover:text-foreground`}
          title="Voice search"
        >
          <Mic className="h-4.5 w-4.5" />
        </button>

        {/* SEARCH */}
        <button onClick={handleSearch}
          className="h-[64px] px-7 bg-primary text-primary-foreground flex items-center gap-2.5 text-[14px] font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shrink-0 rounded-r-2xl">
          <Search className="h-4.5 w-4.5" />
          Search
        </button>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────── */}
      <div className="md:hidden bg-card border border-border/50 rounded-2xl shadow-md overflow-hidden"
        style={{ boxShadow: "0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.04)" }}>
        <div id="field-from-m" onClick={() => toggle("from")}
          className={`flex items-center gap-3 px-5 cursor-pointer select-none transition-all duration-150 h-[54px] border-b border-border/40 ${active("from") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
          <div className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />
          <div className={`flex-1 text-[14px] font-semibold truncate ${from ? "text-foreground" : "text-muted-foreground/40"}`}>
            {from || "Where are you starting?"}
          </div>
          {from && to && (
            <button onClick={swap} className="h-7 w-7 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground shrink-0 hover:bg-accent transition-colors">
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div id="field-to-m" onClick={() => toggle("to")}
          className={`flex items-center gap-3 px-5 cursor-pointer select-none transition-all duration-150 h-[54px] border-b border-border/40 ${active("to") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
          <div className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
          <div className={`flex-1 text-[14px] font-semibold truncate ${to ? "text-foreground" : "text-muted-foreground/40"}`}>
            {to || "Where are you going?"}
          </div>
        </div>

        <div className="flex divide-x divide-border/40 border-b border-border/40">
         <button id="field-date-m" onClick={() => toggle("date")}
            className={`flex items-center gap-2 px-4 cursor-pointer select-none transition-all duration-150 flex-1 h-[50px] ${active("date") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
            <Calendar className="h-4 w-4 text-muted-foreground/70 shrink-0" />
            <span className={`text-[13px] font-semibold ${date ? "text-foreground" : "text-muted-foreground/40"}`}>
              {fmtDate(date)}
            </span>
          </button>
          <button id="field-seats-m" onClick={() => toggle("passengers")}
            className={`flex items-center gap-2 px-4 cursor-pointer select-none transition-all duration-150 w-28 shrink-0 h-[50px] ${active("passengers") ? "bg-primary/[0.04]" : "hover:bg-accent/40"}`}>
            <Users className="h-4 w-4 text-muted-foreground/70 shrink-0" />
            <span className="text-[13px] font-semibold text-foreground">{passengers} {passengers === 1 ? "seat" : "seats"}</span>
          </button>
        </div>

        <div className="flex">
          <button onClick={handleSearch}
            className="flex-1 h-[52px] bg-primary text-primary-foreground flex items-center justify-center gap-2.5 text-[14px] font-bold hover:bg-primary/90 active:scale-[0.99] transition-all">
            <Search className="h-4 w-4" />
            Find rides
          </button>
          <button
            onClick={() => setPanel("voice")}
            className="h-[52px] w-[52px] flex items-center justify-center bg-primary/90 text-primary-foreground border-l border-primary-foreground/20 hover:bg-primary transition-colors shrink-0"
            title="Voice search"
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── PORTALED DROPDOWNS ──────────────────────────────── */}

      {/* Location — anchored to full search bar */}
      <Portal
        anchorId="search-wrap"
        open={panel === "from" || panel === "to"}
        onClose={close}
        align="left"
      >
        {(panel === "from" || panel === "to") && (
          <LocationPanel
            type={panel}
            onSelect={(loc, coords) => {
              if (panel === "from") { setFrom(loc); setFromCoords(coords); }
              else                  { setTo(loc);   setToCoords(coords); }
              close();
            }}
            onClose={close}
          />
        )}
      </Portal>

      {/* Date — single portal, picks whichever anchor is visible */}
      <Portal
        anchorId={window.innerWidth >= 768 ? "field-date" : "field-date-m"}
        open={panel === "date"}
        onClose={close}
        align="left"
        fixedWidth={320}
      >
        <CalendarPicker selected={date} onSelect={d => { setDate(d); close(); }} />
      </Portal>

      {/* Seats — single portal, picks whichever anchor is visible */}
      <Portal
        anchorId={window.innerWidth >= 768 ? "field-seats" : "field-seats-m"}
        open={panel === "passengers"}
        onClose={close}
        align="right"
        fixedWidth={240}
      >
        <SeatPicker value={passengers} onChange={setPassengers} onClose={close} />
      </Portal>

      {/* Voice search — perfectly centered overlay */}
      {panel === "voice" && createPortal(
        <>
          <div className="fixed inset-0 z-[9990] bg-background/80 backdrop-blur-sm" onClick={close} />
          <div
            className="portal-panel fixed z-[9999]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(400px, calc(100vw - 32px))",
            }}
          >
            <VoiceSearch onResult={handleVoiceResult} onClose={close} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
