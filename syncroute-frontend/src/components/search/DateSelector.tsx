import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateSelectorProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  anchorId?: string;
}

export function DateSelector({ selected, onSelect, onClose, anchorId }: DateSelectorProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  // If anchorId provided, render as portal anchored to that element
  // Otherwise fall back to absolute positioning (legacy)
  const content = (
    <div className="calendar-panel p-5">
      <div className="grid md:grid-cols-2 gap-6">
        <MonthGrid
          month={viewMonth}
          year={viewYear}
          today={today}
          selected={selected}
          onSelect={(d) => { onSelect(d); onClose(); }}
          onPrev={() => {
            if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
            else setViewMonth(viewMonth - 1);
          }}
          showNav="left"
        />
        <div className="hidden md:block">
          <MonthGrid
            month={secondMonth}
            year={secondYear}
            today={today}
            selected={selected}
            onSelect={(d) => { onSelect(d); onClose(); }}
            onNext={() => {
              if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
              else setViewMonth(viewMonth + 1);
            }}
            showNav="right"
          />
        </div>
      </div>
    </div>
  );

  if (anchorId) {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = Math.min(640, window.innerWidth - 16);
    let left = rect.left;
    left = Math.min(left, window.innerWidth - panelWidth - 8);
    left = Math.max(8, left);

    // Prefer below, but flip above if not enough space
    const panelHeight = 320; // approximate
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const top = spaceBelow >= panelHeight
      ? rect.bottom + 8
      : spaceAbove >= panelHeight
        ? rect.top - panelHeight - 8
        : rect.bottom + 8; // default below even if tight

    return createPortal(
      <>
        <div className="fixed inset-0 z-[9990]" onClick={onClose} />
        <div
          className="fixed z-[9999]"
          style={{ top, left, width: panelWidth }}
        >
          {content}
        </div>
      </>,
      document.body
    );
  }

  // Legacy: render inline with relative parent
  return (
    <div className="absolute left-0 right-0 top-full z-50 border border-t-0 border-border bg-card p-4 rounded-b-xl shadow-xl">
      <div className="grid md:grid-cols-2 gap-6">
        <MonthGrid
          month={viewMonth}
          year={viewYear}
          today={today}
          selected={selected}
          onSelect={(d) => { onSelect(d); onClose(); }}
          onPrev={() => {
            if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
            else setViewMonth(viewMonth - 1);
          }}
          showNav="left"
        />
        <div className="hidden md:block">
          <MonthGrid
            month={secondMonth}
            year={secondYear}
            today={today}
            selected={selected}
            onSelect={(d) => { onSelect(d); onClose(); }}
            onNext={() => {
              if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
              else setViewMonth(viewMonth + 1);
            }}
            showNav="right"
          />
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  month,
  year,
  today,
  selected,
  onSelect,
  onPrev,
  onNext,
  showNav,
}: {
  month: number;
  year: number;
  today: Date;
  selected?: Date;
  onSelect: (date: Date) => void;
  onPrev?: () => void;
  onNext?: () => void;
  showNav: "left" | "right";
}) {
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
    const result: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) result.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) result.push(new Date(year, month, d));
    return result;
  }, [month, year]);

  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const isSelected = (d: Date) => selected?.toDateString() === d.toDateString();
  const isPast = (d: Date) => {
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    return d < t;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {showNav === "left" ? (
          <button onClick={onPrev} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-accent transition-all duration-150 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : <div />}
        <span className="text-sm font-semibold text-foreground tracking-tight">{monthName}</span>
        {showNav === "right" ? (
          <button onClick={onNext} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-accent transition-all duration-150 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : <div />}
      </div>
      <div className="grid grid-cols-7 gap-0 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="h-8 flex items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <div key={i} className="h-10 flex items-center justify-center">
            {day ? (
              <button
                disabled={isPast(day)}
                onClick={() => onSelect(day)}
                className={`calendar-day-btn ${
                  isSelected(day) ? "selected" :
                  isToday(day) ? "today" :
                  isPast(day) ? "" : ""
                }`}
              >
                {day.getDate()}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
