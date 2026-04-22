import { useState } from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

interface TimeSelectorProps {
  selected: string;
  onSelect: (time: string) => void;
  onClose: () => void;
  anchorId?: string;
}

const periods = [
  { label: "Morning", emoji: "🌅", range: "06:00 – 12:00", times: ["06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30"] },
  { label: "Afternoon", emoji: "☀️", range: "12:00 – 18:00", times: ["12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"] },
  { label: "Evening", emoji: "🌆", range: "18:00 – 00:00", times: ["18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"] },
];

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function TimeSelector({ selected, onSelect, onClose, anchorId }: TimeSelectorProps) {
  const [activePeriod, setActivePeriod] = useState<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const calc = () => {
      const el = anchorId ? document.getElementById(anchorId) : null;
      if (!el) {
        // No anchor — center on screen
        setPos({ top: window.innerHeight / 2 - 200, left: window.innerWidth / 2 - 180, width: 360 });
        return;
      }
      const r = el.getBoundingClientRect();
      const w = Math.min(360, window.innerWidth - 16);
      let left = r.left;
      left = Math.min(left, window.innerWidth - w - 8);
      left = Math.max(8, left);
      // Position above if not enough space below
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const panelH = 320;
      const top = spaceBelow >= panelH ? r.bottom + 6 : r.top - panelH - 6;
      setPos({ top, left, width: w });
    };
    calc();
    window.addEventListener("scroll", calc, true);
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc, true);
      window.removeEventListener("resize", calc);
    };
  }, [anchorId]);

  if (!pos) return null;

  const content = (
    <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 360 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        {activePeriod !== null ? (
          <button
            onClick={() => setActivePeriod(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {periods[activePeriod].label}
          </button>
        ) : (
          <span className="text-sm font-semibold text-foreground">Select departure time</span>
        )}
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>

      {activePeriod === null ? (
        /* Period selection */
        <div className="divide-y divide-border">
          {periods.map((period, idx) => (
            <button
              key={period.label}
              onClick={() => setActivePeriod(idx)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-accent transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{period.emoji}</span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{period.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{period.range}</div>
                </div>
              </div>
              <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform">›</span>
            </button>
          ))}
        </div>
      ) : (
        /* Time grid */
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {periods[activePeriod].times.map((t) => (
              <button
                key={t}
                onClick={() => { onSelect(t); onClose(); }}
                className={`h-11 rounded-xl text-sm font-semibold transition-all ${
                  selected === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 hover:bg-accent text-foreground border border-border hover:border-foreground/20"
                }`}
              >
                {fmt12(t)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9990]" onClick={onClose} />
      <div className="fixed z-[9999]" style={{ top: pos.top, left: pos.left, width: pos.width }}>
        {content}
      </div>
    </>,
    document.body
  );
}
