import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateSelectorProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

export function DateSelector({ selected, onSelect, onClose }: DateSelectorProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  return (
    <div className="absolute left-0 right-0 top-full z-50 border border-t-0 border-border bg-card p-4">
      <div className="grid md:grid-cols-2 gap-6">
        <MonthGrid
          month={viewMonth}
          year={viewYear}
          today={today}
          selected={selected}
          onSelect={onSelect}
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
            onSelect={onSelect}
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
      <div className="flex items-center justify-between mb-3">
        {showNav === "left" ? (
          <button onClick={onPrev} className="h-8 w-8 flex items-center justify-center border border-border rounded-sm transition-system control-hover">
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : <div />}
        <span className="text-sm font-semibold">{monthName}</span>
        {showNav === "right" ? (
          <button onClick={onNext} className="h-8 w-8 flex items-center justify-center border border-border rounded-sm transition-system control-hover">
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : <div />}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="h-8 flex items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <div key={i} className="h-10 flex items-center justify-center">
            {day ? (
              <button
                disabled={isPast(day)}
                onClick={() => onSelect(day)}
                className={`h-9 w-9 flex items-center justify-center text-sm rounded-sm transition-system ${
                  isSelected(day)
                    ? "bg-primary text-primary-foreground font-medium"
                    : isToday(day)
                    ? "border border-primary text-primary font-medium"
                    : isPast(day)
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "hover:bg-accent"
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
