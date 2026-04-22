import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  ChevronRight, CheckCircle, XCircle, AlertCircle, Package,
  Activity, Award, MessageSquare
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { format } from "date-fns";
import { OngoingRideCard } from "@/components/rides/OngoingRideCard";
import { UpcomingRidesSection } from "@/components/rides/UpcomingRidesSection";

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
  confirmed: { label: "Confirmed", icon: <CheckCircle className="h-3.5 w-3.5" />, color: "text-success bg-success/10" },
  completed: { label: "Completed", icon: <CheckCircle className="h-3.5 w-3.5" />, color: "text-primary bg-primary/10" },
  pending: { label: "Pending", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-warning bg-warning/10" },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-destructive bg-destructive/10" },
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
      icon: <IndianRupee className="h-5 w-5" />,
      color: "text-success bg-success/10",
      trend: "+12.5%"
    },
    {
      label: "Completed Trips",
      value: earnings?.completedTrips ?? 0,
      icon: <CheckCircle className="h-5 w-5" />,
      color: "text-primary bg-primary/10",
      trend: "+8"
    },
    {
      label: "Pending Earnings",
      value: earnings ? `₹${earnings.pendingEarnings.toLocaleString("en-IN")}` : "₹0",
      icon: <Clock className="h-5 w-5" />,
      color: "text-warning bg-warning/10",
    },
    {
      label: "Avg. Per Trip",
      value: earnings ? `₹${earnings.avgPerTrip.toLocaleString("en-IN")}` : "₹0",
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-brand-accent bg-brand-accent/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
              Driver Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, <span className="font-semibold text-foreground">{user?.name?.split(" ")[0]}</span>
            </p>
          </div>
          <button
            onClick={() => navigate("/offer-ride")}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg btn-primary text-base font-semibold shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Plus className="h-5 w-5" />
            Offer Ride
          </button>
        </div>

        {/* Ongoing Ride - appears at top when there's an active ride */}
        <OngoingRideCard />

        {/* Upcoming Rides Section */}
        <UpcomingRidesSection />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card-elevated p-6">
                  <Skeleton className="h-5 w-28 mb-4" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))
            : statCards.map((card) => (
                <div
                  key={card.label}
                  className="card-elevated p-6 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl ${card.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      {card.icon}
                    </div>
                    {card.trend && (
                      <span className="text-xs font-semibold text-success flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {card.trend}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {card.label}
                  </p>
                  <p className="text-2xl md:text-3xl font-display font-bold text-foreground">{card.value}</p>
                </div>
              ))}
        </div>

        {/* Earnings Chart */}
        <div className="card-elevated p-6 lg:p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">Monthly Earnings</h2>
              <p className="text-sm text-muted-foreground">Revenue from completed rides</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </div>
          
          {loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={<Car className="h-8 w-8" />}
              title="No earnings yet"
              description="Complete your first ride to see earnings here"
              action={{ label: "Offer a Ride", onClick: () => navigate("/offer-ride") }}
            />
          ) : (
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--brand-accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--brand-accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v}`}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: 13,
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number) => [`₹${value}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--brand-accent))"
                    strokeWidth={3}
                    fill="url(#earningsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="card-elevated overflow-hidden">
          <div className="px-6 lg:px-8 py-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">Recent Bookings</h2>
              <p className="text-sm text-muted-foreground">Passengers who booked your rides</p>
            </div>
            <button
              onClick={() => navigate("/profile?tab=ride-bookings")}
              className="text-sm text-primary hover:text-primary/80 font-semibold flex items-center gap-1 group"
            >
              View all 
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {loading ? (
            <div className="p-6 lg:p-8 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="No bookings yet"
                description="Offer a ride to start receiving bookings"
                action={{ label: "Offer a Ride", onClick: () => navigate("/offer-ride") }}
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {bookings.slice(0, 8).map((booking) => {
                const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                const initial = booking.passenger?.name?.slice(0, 2).toUpperCase() || "??";
                
                return (
                  <div 
                    key={booking._id} 
                    className="px-6 lg:px-8 py-4 flex items-center gap-4 hover:bg-accent/30 transition-all duration-200"
                  >
                    <div className="h-12 w-12 rounded-xl bg-accent border border-border flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                      {initial}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate mb-1">
                        {booking.passenger?.name || "Passenger"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {booking.ride?.from?.name && booking.ride?.to?.name
                          ? `${booking.ride.from.name} → ${booking.ride.to.name}`
                          : "Route info unavailable"}
                      </p>
                      {booking.ride?.date && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {booking.ride.date}
                        </p>
                      )}
                    </div>
                    
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${status.color}`}>
                      {status.icon}
                      <span>{status.label}</span>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-foreground">₹{booking.totalPrice}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.seats} seat{booking.seats > 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* Chat button */}
                    {booking.status !== "cancelled" && booking.passenger?._id && booking.ride?._id && (
                      <Link
                        to={`/chat?rideId=${booking.ride._id}&userId=${booking.passenger._id}&userName=${encodeURIComponent(booking.passenger.name || "Passenger")}&route=${encodeURIComponent(`${booking.ride?.from?.name || ""} → ${booking.ride?.to?.name || ""}`)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="h-9 w-9 flex items-center justify-center border border-border/60 rounded-xl hover:bg-accent transition-colors shrink-0"
                        title={`Chat with ${booking.passenger.name}`}
                      >
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    )}
                    
                    <button
                      onClick={() => navigate(`/rides/${booking.ride?._id}`)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-xl transition-colors shrink-0"
                    >
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Achievement Banner */}
        {earnings && earnings.completedTrips >= 10 && (
          <div className="mt-8 card-elevated p-6 bg-gradient-to-r from-brand-accent/10 to-transparent border-brand-accent/20">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-brand-accent/20 flex items-center justify-center shrink-0">
                <Award className="h-7 w-7 text-brand-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-display font-bold text-foreground mb-1">
                  Experienced Driver
                </h3>
                <p className="text-sm text-muted-foreground">
                  You've completed {earnings.completedTrips} trips! Keep up the great work.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
