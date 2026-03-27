import { Check } from "lucide-react";

const STEPS = [
  { key: "pending", label: "Booked" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in-progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
] as const;

type BookingStatus = "pending" | "confirmed" | "in-progress" | "completed" | "cancelled";

export function RideStatusTimeline({ status }: { status: BookingStatus }) {
  const currentIndex = STEPS.findIndex((s) => s.key === status);
  const isCancelled = status === "cancelled";

  return (
    <div className="flex items-start gap-0 w-full">
      {STEPS.map((step, i) => {
        const isCompleted = !isCancelled && currentIndex > i;
        const isCurrent = !isCancelled && currentIndex === i;

        return (
          <div key={step.key} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCancelled
                    ? "border-border bg-muted"
                    : isCompleted
                    ? "border-violet-500 bg-violet-500"
                    : isCurrent
                    ? "border-violet-500 bg-violet-500/15 animate-pulse-glow"
                    : "border-border bg-muted"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-white" />
                ) : (
                  <div
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      isCurrent && !isCancelled ? "bg-violet-500" : "bg-border"
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                  isCancelled
                    ? "text-muted-foreground/40"
                    : isCompleted || isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-4 transition-all duration-300 ${
                  isCompleted && !isCancelled ? "bg-violet-500" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
