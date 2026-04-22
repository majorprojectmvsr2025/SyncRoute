import { useState, useEffect } from "react";
import { statsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Car,
  MapPin,
  Leaf,
  IndianRupee,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";

interface RideStats {
  totalRidesAsDriver: number;
  totalRidesAsPassenger: number;
  totalRides: number;
  totalDistanceKm: number;
  totalMoneySaved: number;
  totalCO2SavedKg: number;
}

interface MonthlyData {
  month: string;
  rides: number;
  amount: number;
}

interface RideStatsDashboardProps {
  userId?: string;
}

export function RideStatsDashboard({ userId }: RideStatsDashboardProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<RideStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?._id;

  useEffect(() => {
    if (targetUserId) {
      loadStats();
    }
  }, [targetUserId]);

  const loadStats = async () => {
    if (!targetUserId) return;
    try {
      const [userStats, monthly] = await Promise.all([
        statsAPI.getUserStats(targetUserId),
        statsAPI.getMonthlyStats(targetUserId, 6).catch(() => [])
      ]);
      setStats(userStats);
      setMonthlyData(monthly || []);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (str: string) => {
    const [year, month] = str.split("-");
    return new Date(Number(year), Number(month) - 1).toLocaleString("default", { 
      month: "short"
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No ride statistics available yet.</p>
        <p className="text-sm mt-1">Complete some rides to see your insights!</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Rides",
      value: stats.totalRides,
      icon: <Car className="h-5 w-5" />,
      color: "text-blue-500 bg-blue-500/10",
      detail: `${stats.totalRidesAsDriver} as driver, ${stats.totalRidesAsPassenger} as passenger`
    },
    {
      label: "Distance Travelled",
      value: `${stats.totalDistanceKm.toLocaleString()} km`,
      icon: <MapPin className="h-5 w-5" />,
      color: "text-purple-500 bg-purple-500/10",
      detail: "Total carpooling distance"
    },
    {
      label: "Money Saved",
      value: `₹${stats.totalMoneySaved.toLocaleString()}`,
      icon: <IndianRupee className="h-5 w-5" />,
      color: "text-green-500 bg-green-500/10",
      detail: "vs driving alone"
    },
    {
      label: "CO₂ Saved",
      value: `${stats.totalCO2SavedKg} kg`,
      icon: <Leaf className="h-5 w-5" />,
      color: "text-emerald-500 bg-emerald-500/10",
      detail: "Environmental impact"
    }
  ];

  const chartData = monthlyData.map(m => ({
    month: formatMonth(m.month),
    rides: m.rides,
    amount: m.amount
  }));

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Ride Insights</h3>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
          </div>
        ))}
      </div>

      {/* Monthly rides chart */}
      {chartData.length > 0 && (
        <div className="p-6 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="font-semibold">Monthly Activity</h4>
              <p className="text-sm text-muted-foreground">Your ride history over the past 6 months</p>
            </div>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  name === "rides" ? `${value} rides` : `₹${value}`,
                  name === "rides" ? "Rides" : "Amount"
                ]}
              />
              <Bar
                dataKey="rides"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Environmental impact */}
      <div className="p-6 rounded-xl border border-border bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
            <Leaf className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">
              Your Environmental Impact
            </h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
              By carpooling, you've saved <strong>{stats.totalCO2SavedKg} kg</strong> of CO₂ emissions!
              That's equivalent to {Math.max(1, Math.round(stats.totalCO2SavedKg / 21))} tree{Math.round(stats.totalCO2SavedKg / 21) !== 1 ? 's' : ''} absorbing carbon for a year.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RideStatsDashboard;
