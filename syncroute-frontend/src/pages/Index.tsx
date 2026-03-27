import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SearchModule } from "@/components/search/SearchModule";
import {
  Shield, Zap, MapPin, ArrowRight, Users, Car, Star, Clock,
  CheckCircle2, Route, ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { statsAPI, ridesAPI } from "@/lib/api";

const Index = () => {
  const [stats, setStats] = useState<any>(null);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, ridesData] = await Promise.all([
          statsAPI.getPlatformStats(),
          ridesAPI.getAll(),
        ]);
        setStats(statsData);
        const activeRides = ridesData.filter((r: any) => r.status === "active");
        setRecentRides(activeRides.slice(0, 6));
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">

        {/* ━━ Hero ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="pt-16 pb-12 md:pt-24 md:pb-20 lg:pt-32 lg:pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-6 md:mb-10">
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-foreground leading-[1.15] mb-4">
                Your pick of rides<br />
                at low prices
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                Find verified carpools going your way, or share your empty seats and split the cost.
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <SearchModule />
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-foreground" />
                ID-verified drivers
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-foreground" />
                Instant booking
              </span>
              <span className="flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5 text-foreground" />
                Smart route matching
              </span>
            </div>
          </div>
        </section>

        {/* ━━ Stats bar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* {stats && (
          <section className="border-y border-border bg-muted/40">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <StatItem value={fmt(stats.rides?.active || recentRides.length || 0)} label="Active rides" />
                <StatItem value={fmt((stats.users?.total || 0) + 500) + "+"} label="Registered users" />
                <StatItem value={fmt((stats.bookings?.completed || 0) + 1200) + "+"} label="Trips completed" />
                <StatItem value={fmt((stats.impact?.countries || 0) + 22) + "+"} label="Cities covered" />
              </div>
            </div>
          </section>
        )} */}

        {/* ━━ Available Rides ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {recentRides.length > 0 && (
          <section className="py-14 md:py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Available rides</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {recentRides.length} ride{recentRides.length !== 1 ? "s" : ""} departing soon
                  </p>
                </div>
                <Link
                  to="/search"
                  className="text-sm text-foreground font-medium flex items-center gap-1 hover:underline underline-offset-4"
                >
                  View all <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentRides.map((ride) => (
                  <RidePreviewCard key={ride._id} ride={ride} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ━━ How it works ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="border-t border-border py-14 md:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">How it works</h2>
              <p className="text-sm text-muted-foreground mt-2">Get from A to B in three simple steps</p>
            </div>

            <div className="grid md:grid-cols-3 gap-10 md:gap-8">
              {[
                {
                  num: "1",
                  icon: <MapPin className="h-5 w-5" />,
                  title: "Search your route",
                  desc: "Enter pickup and destination with your travel date. We'll find matching rides instantly.",
                },
                {
                  num: "2",
                  icon: <Users className="h-5 w-5" />,
                  title: "Choose your ride",
                  desc: "Compare drivers, prices, ratings and vehicle types. Pick the one that fits best.",
                },
                {
                  num: "3",
                  icon: <CheckCircle2 className="h-5 w-5" />,
                  title: "Book and travel",
                  desc: "Reserve instantly, message the driver, and share the journey together.",
                },
              ].map((step) => (
                <div key={step.num} className="flex flex-col items-center text-center">
                  <div className="h-14 w-14 rounded-2xl bg-foreground text-background flex items-center justify-center mb-5">
                    {step.icon}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Step {step.num}
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━ Trust and Safety ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="border-t border-border py-14 md:py-20 bg-muted/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Built for trust</h2>
              <p className="text-sm text-muted-foreground mt-2">Every ride backed by verification and safety features</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  icon: <Shield className="h-5 w-5" />,
                  title: "4-layer verification",
                  desc: "OCR scanning, format checks, expiry validation, and tamper detection on every driver document.",
                },
                {
                  icon: <Zap className="h-5 w-5" />,
                  title: "Instant confirmation",
                  desc: "Real-time seat availability. Book in seconds with no waiting for driver approval.",
                },
                {
                  icon: <MapPin className="h-5 w-5" />,
                  title: "Smart matching",
                  desc: "Finds rides within 50 km of your pickup and drop, even when exact locations differ.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="bg-card border border-border rounded-xl p-6"
                >
                  <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center text-foreground mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="border-t border-border py-16 md:py-24">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3">
              Have empty seats?
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
              Offer rides on trips you're already making. Cover fuel costs and make your commute social.
            </p>
            <Link
              to="/offer-ride"
              className="inline-flex items-center gap-2.5 h-12 px-8 bg-foreground text-background rounded-lg text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              Offer a ride <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
};

/* ── Sub-components ─────────────────────────────────────────── */

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  );
}

function RidePreviewCard({ ride }: { ride: any }) {
  const driver = ride.driver || {};
  const initial = driver.name?.[0]?.toUpperCase() || "?";

  // Compute estimated arrival
  let arrivalDisplay: string | null = ride.arrivalTime || null;
  let durationDisplay: string | null = null;
  if (!arrivalDisplay && ride.departureTime) {
    let totalMinutes = 0;
    if (ride.estimatedDuration && ride.estimatedDuration > 0) {
      totalMinutes = Math.round((ride.estimatedDuration * 1.6) / 60);
    } else if (ride.routePath?.coordinates?.length > 1) {
      let totalDist = 0;
      const R = 6371;
      const coords = ride.routePath.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      totalMinutes = Math.round((totalDist / 28) * 60);
    }
    if (totalMinutes > 0) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      durationDisplay = h > 0 ? (m > 0 ? `~${h}h ${m}m` : `~${h}h`) : `~${m}m`;
      try {
        const [dh, dm] = ride.departureTime.split(":").map(Number);
        const total = (dh * 60 + dm + totalMinutes) % (24 * 60);
        const ah = Math.floor(total / 60);
        const am = total % 60;
        arrivalDisplay = `${String(ah).padStart(2, "0")}:${String(am).padStart(2, "0")}`;
      } catch { /* ignore */ }
    }
  }

  return (
    <Link
      to={`/rides/${ride._id}`}
      className="group block border border-border rounded-xl bg-card p-5 hover:border-foreground/20 transition-colors"
    >
      {/* Route */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-lg font-semibold tabular-nums">{ride.departureTime || "\u2014"}</span>
            <span className="text-sm font-medium truncate text-foreground">{ride.from?.name || "Origin"}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm tabular-nums text-muted-foreground">{arrivalDisplay || "\u2014"}</span>
            <span className="text-sm text-muted-foreground truncate">{ride.to?.name || "Destination"}</span>
          </div>
          {durationDisplay && (
            <div className="flex items-center gap-1.5 mt-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{durationDisplay}</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold tabular-nums">{"\u20B9"}{ride.price}</div>
          <div className="text-[11px] text-muted-foreground">per seat</div>
        </div>
      </div>

      {/* Driver meta */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          {driver.photo ? (
            <img src={driver.photo} className="h-6 w-6 rounded-full object-cover" alt="" />
          ) : (
            <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">{initial}</span>
          )}
          <span className="text-sm font-medium">{driver.name?.split(" ")[0] || "Driver"}</span>
          {driver.rating > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {driver.rating?.toFixed(1)}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {ride.availableSeats} seat{ride.availableSeats !== 1 ? "s" : ""} left
        </span>
      </div>
    </Link>
  );
}

export default Index;
