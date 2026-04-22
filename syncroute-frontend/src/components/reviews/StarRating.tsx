import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
}

export function StarRating({ value, onChange, size = "md", showValue = false }: StarRatingProps) {
  const sizeClass = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-6 w-6",
  }[size];

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(star)}
            className={`${onChange ? "cursor-pointer hover:scale-110 active:scale-95" : "cursor-default"} transition-transform duration-100`}
          >
            <Star
              className={`${sizeClass} transition-colors ${
                star <= Math.round(value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
      </div>
      {showValue && (
        <span className={`font-medium text-foreground ${size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"}`}>
          {value > 0 ? value.toFixed(1) : "—"}
        </span>
      )}
    </div>
  );
}
