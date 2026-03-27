import { useState } from "react";

interface TimeSelectorProps {
  selected: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}

const periods = [
  { label: "Morning", range: "06:00 – 12:00", times: ["06:00", "06:15", "06:30", "06:45", "07:00", "07:15", "07:30", "07:45", "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45"] },
  { label: "Afternoon", range: "12:00 – 18:00", times: ["12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45", "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30", "17:45"] },
  { label: "Evening", range: "18:00 – 00:00", times: ["18:00", "18:15", "18:30", "18:45", "19:00", "19:15", "19:30", "19:45", "20:00", "20:15", "20:30", "20:45", "21:00", "21:15", "21:30", "21:45", "22:00", "22:15", "22:30", "22:45", "23:00", "23:15", "23:30", "23:45"] },
];

export function TimeSelector({ selected, onSelect, onClose }: TimeSelectorProps) {
  const [activePeriod, setActivePeriod] = useState<number | null>(null);

  return (
    <div className="absolute left-0 right-0 top-full z-50 border border-t-0 border-border bg-card">
      {activePeriod === null ? (
        <div className="divide-y divide-border">
          {periods.map((period, idx) => (
            <button
              key={period.label}
              onClick={() => setActivePeriod(idx)}
              className="w-full flex items-center justify-between px-4 py-4 text-left transition-system hover:bg-accent"
            >
              <span className="text-sm font-medium">{period.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{period.range}</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 px-4 h-10 border-b border-border">
            <button onClick={() => setActivePeriod(null)} className="text-xs text-muted-foreground hover:text-foreground transition-system">
              ← Back
            </button>
            <span className="text-xs font-medium">{periods[activePeriod].label}</span>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-0 max-h-64 overflow-y-auto">
            {periods[activePeriod].times.map((t) => (
              <button
                key={t}
                onClick={() => onSelect(t)}
                className={`h-10 flex items-center justify-center text-sm font-mono transition-system border-b border-r border-border ${
                  selected === t
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
