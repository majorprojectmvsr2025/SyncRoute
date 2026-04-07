import { Minus, Plus } from "lucide-react";

interface PassengerSelectorProps {
  value: number;
  onChange: (v: number) => void;
  onClose: () => void;
}

export function PassengerSelector({ value, onChange, onClose }: PassengerSelectorProps) {
  return (
    <div className="absolute right-0 top-full z-50 border border-t-0 border-border bg-card w-64">
      <div className="px-4 py-2 border-b border-border">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Passengers</span>
      </div>
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-sm font-medium">Passengers</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onChange(Math.max(1, value - 1))}
            disabled={value <= 1}
            className="h-8 w-8 flex items-center justify-center border border-border rounded-sm transition-system control-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-lg font-semibold font-mono w-6 text-center">{value}</span>
          <button
            onClick={() => onChange(Math.min(6, value + 1))}
            disabled={value >= 6}
            className="h-8 w-8 flex items-center justify-center border border-border rounded-sm transition-system control-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <button
          onClick={onClose}
          className="w-full h-9 bg-primary text-primary-foreground text-sm font-medium rounded-sm transition-system hover:opacity-90"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
