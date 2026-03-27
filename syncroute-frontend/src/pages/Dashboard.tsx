import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { driverAPI, bookingsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import {
  IndianRupee, Car, TrendingUp, Clock, Plus, Users,
  ChevronRight, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { format } from "date-fns";

interface EarningsData {
  totalEarnings: number;
  pendingEarnings: number;
  completedTrips: number;
  avgPerTrip: number;
  monthlyBreakdown: { month: string; revenue: number; trips: number }[];
}

interface Booking {
  _id: string;
  status: string;
  totalPrice: number;
  seats: number;
  createdAt: string;
  passenger?: { name: string };
  ride?: {
    from?: { name: string };
    to?: { name: string };
    date?: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  confirmed: { label: "Confirmed", icon: <CheckCircle className="h-3 w-3" />, color: "text-green-500 bg-green-500/10" },
  completed: { label: "Completed", icon: <CheckCircle className="h-3 w-3" />, color: "text-blue-500 bg-blue-500/10" },
  pending: { label: "Pending", icon: <AlertCircle className="h-3 w-3" />, color: "text-amber-500 bg-amber-500/10" },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-3 w-3" />, color: "text-red-500 bg-red-500/10" },
};

function formatMonth(str: string) {
  const [year, month] = str.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleString("default", { month: "short", year: "2-digit" });
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      driverAPI.getEarnings(),
      bookingsAPI.getRideBookings()
    ])
      .then(([e, b]) => {
        setEarnings(e);
        setBookings(b);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const chartData = earnings?.monthlyBreakdown.map(m => ({
    month: formatMonth(m.month),
    revenue: m.revenue,
    trips: m.trips,
  })) || [];

  const statCards = [
    {
      label: "Total Earnings",
      value: earnings ? `₹${earnings.totalEarnings.toLocaleString("en-IN")}` : "₹0",
      icon: <IndianRupee className="h-4 w-4" />,
    },
    {
      label: "Completed Trips",
      value: earnings?.completedTrips ?? 0,
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      label: "Pending Earnings",
      value: earnings ? `₹${earnings.pendingEarnings.toLocaleString("en-IN")}` : "₹0",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Avg. Per Trip",
      value: earnings ? `₹${earnings.avgPerTrip.toLocaleString("en-IN")}` : "₹0",
      icon: <TrendingUp className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              Driver Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back, {user?.name?.split(" ")[0]}
            </p>
          </div>
          <button
            onClick={() => navigate("/offer-ride")}
            className="h-9 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Offer Ride
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-5 border border-border rounded-xl">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-7 w-20" />
                </div>
              ))
            : statCards.map((card) => (
                <div
                  key={card.label}
                  className="p-5 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {card.label}
                    </span>
                    <div className="text-muted-foreground">{card.icon}</div>
                  </div>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              ))}
        </div>

        {/* Earnings Chart */}
        <div className="border border-border rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold">Monthly Earnings</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Revenue from completed rides</p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          {loading ? (
            <Skeleton className="h-52 w-full rounded-lg" />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={<Car className="h-7 w-7" />}
              title="No earnings yet"
              description="Complete your first ride to see earnings here"
              action={{ label: "Offer a Ride", onClick: () => navigate("/offer-ride") }}
            />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`₹${value}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#earningsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Recent Bookings</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Passengers who booked your rides</p>
            </div>
            <button
              onClick={() => navigate("/profile?tab=ride-bookings")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No bookings yet"
              description="Offer a ride to start receiving bookings"
              action={{ label: "Offer a Ride", onClick: () => navigate("/offer-ride") }}
            />
          ) : (
            <div className="divide-y divide-border">
              {bookings.slice(0, 8).map((booking) => {
                const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                return (
                  <div key={booking._id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-accent/30 transition-system">
                    <div className="h-8 w-8 rounded-sm bg-muted border border-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                      {booking.passenger?.name?.slice(0, 2).toUpperCase() || "??"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{booking.passenger?.name || "Passenger"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {booking.ride?.from?.name && booking.ride?.to?.name
                          ? `${booking.ride.from.name} → ${booking.ride.to.name}`
                          : "Route info unavailable"}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-medium ${status.color}`}>
                      {status.icon}
                      <span>{status.label}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">₹{booking.totalPrice}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {booking.seats} seat{booking.seats > 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground shrink-0 hidden lg:block">
                      {booking.createdAt
                        ? format(new Date(booking.createdAt), "dd MMM")
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
