import { systemMetrics } from "@/data/mockData";
import { Activity, Clock, Leaf } from "lucide-react";

export function SystemIndicators() {
  return (
    <div className="border border-border bg-card divide-x divide-border grid grid-cols-3">
      <Metric
        icon={<Activity className="h-3.5 w-3.5" />}
        value={systemMetrics.activeRides.toLocaleString()}
        label="Rides active today"
        live
      />
      <Metric
        icon={<Clock className="h-3.5 w-3.5" />}
        value={`${systemMetrics.avgMatchTime}s`}
        label="Avg match time"
      />
      <Metric
        icon={<Leaf className="h-3.5 w-3.5" />}
        value={`${systemMetrics.co2Saved}t`}
        label="CO₂ saved this week"
      />
    </div>
  );
}

function Metric({
  icon,
  value,
  label,
  live,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold font-mono">{value}</span>
          {live && <span className="h-1.5 w-1.5 rounded-full bg-system-green animate-pulse-subtle" />}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
