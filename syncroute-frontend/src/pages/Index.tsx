import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SearchModule } from "@/components/search/SearchModule";
import {
  Shield, MapPin, ArrowRight, Users, Star, Car,
  CheckCircle2, ChevronRight, Calendar, Zap, TrendingUp,
  MessageCircle, Leaf, IndianRupee, Navigation, Clock,
  Quote, Smartphone, Lock, Route, Sparkles
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ridesAPI, bookingsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import IntroAnimation from "@/components/IntroAnimation";
import { ShinyText } from "@/components/ui/ShinyText";
import { MarqueeTicker } from "@/components/ui/MarqueeTicker";
import { UserAvatar } from "@/components/ui/UserAvatar";

/* ── Scroll-reveal hook ─────────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []); // Empty deps - threshold is stable
  return { ref, visible };
}

/* ── Parallax scroll hook ───────────────────────────────────────── */
function useParallax(speed = 0.5) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const handleScroll = () => setOffset(window.pageYOffset * speed);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Empty deps - speed is stable
  return offset;
}

/* ── Animated counter hook ──────────────────────────────────────── */
function useCounter(end: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasStarted) return;
    
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
          let start = 0;
          const increment = end / (duration / 16);
          const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
              setCount(end);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasStarted]); // Only depend on hasStarted, end and duration are stable

  return { ref, count };
}

/* ── Reveal wrapper ─────────────────────────────────────────────── */
function Reveal({
  children, delay = 0, className = "", from = "bottom"
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  from?: "bottom" | "left" | "right" | "none";
}) {
  const { ref, visible } = useReveal();
  const translate = from === "bottom" ? "translateY(32px)"
    : from === "left" ? "translateX(-32px)"
    : from === "right" ? "translateX(32px)"
    : "none";
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : translate,
        transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */
const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [todayRides, setTodayRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState({ avgRating: 0, totalRides: 0, activeDrivers: 0 });
  const parallaxOffset = useParallax(0.3);

  // Show intro animation only on first visit per session
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem("syncroute_intro_seen");
  });

  const handleIntroComplete = () => {
    sessionStorage.setItem("syncroute_intro_seen", "1");
    setShowIntro(false);
  };

  useEffect(() => {
    const isRelevant = (ride: any) => {
      // Show all rides that haven't departed yet
      if (!ride.date || !ride.departureTime) return true;
      const rideDateTime = new Date(`${ride.date}T${ride.departureTime}`);
      const now = new Date();
      // Show if ride hasn't departed yet (allow up to departure time)
      return rideDateTime.getTime() >= now.getTime();
    };

    const fetchData = async () => {
      try {
        const all = await ridesAPI.getAll();
        
        // Filter for upcoming rides (today or future, active status)
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const upcomingRides = all.filter((r: any) => {
          if (r.status !== "active") return false;
          
          // Parse ride date
          const rideDate = new Date(r.date);
          const rideDateOnly = new Date(rideDate.getFullYear(), rideDate.getMonth(), rideDate.getDate());
          
          // Show rides from today onwards
          if (rideDateOnly < today) return false;
          
          // If ride is today, check if it hasn't departed yet
          if (rideDateOnly.getTime() === today.getTime() && r.departureTime) {
            const [hours, minutes] = r.departureTime.split(':').map(Number);
            const rideDateTime = new Date(now);
            rideDateTime.setHours(hours, minutes, 0, 0);
            
            // Show if departure hasn't happened yet (allow booking until departure time)
            // This allows passengers to see and book rides even if they're departing very soon
            return rideDateTime.getTime() >= now.getTime();
          }
          
          return true;
        }).sort((a: any, b: any) => {
          // Sort by date first, then by time
          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateCompare !== 0) return dateCompare;
          return (a.departureTime || '').localeCompare(b.departureTime || '');
        });
        
        setRecentRides(upcomingRides.slice(0, 6));
        
        // Calculate real platform statistics
        const activeRides = all.filter((r: any) => r.status === "active");
        const driversWithRatings = activeRides.filter((r: any) => 
          r.driver?.reviewStats?.avgStars || r.driver?.reliabilityScore?.avgRating
        );
        
        const avgRating = driversWithRatings.length > 0
          ? driversWithRatings.reduce((sum: number, r: any) => 
              sum + (r.driver?.reviewStats?.avgStars || r.driver?.reliabilityScore?.avgRating || 0), 0
            ) / driversWithRatings.length
          : 0;
        
        const uniqueDrivers = new Set(activeRides.map((r: any) => r.driver?._id).filter(Boolean)).size;
        
        setPlatformStats({
          avgRating: Math.round(avgRating * 10) / 10,
          totalRides: all.length,
          activeDrivers: uniqueDrivers
        });
      } catch { /* silent */ } finally { setLoading(false); }
    };

    const fetchToday = async () => {
      if (!user) return;
      try {
        const today = new Date().toISOString().split("T")[0];
        const [myRides, myBookings] = await Promise.all([ridesAPI.getMyRides(), bookingsAPI.getMyBookings()]);
        const driver = myRides.filter((r: any) => r.date === today && r.status === "active" && isRelevant(r));
        const passenger = myBookings
          .filter((b: any) => b.ride?.date === today && b.status !== "cancelled" && b.ride?.status === "active" && isRelevant(b.ride))
          .map((b: any) => ({ ...b.ride, _isBooking: true }));
        setTodayRides([...driver, ...passenger].sort((a, b) =>
          (a.departureTime || "").localeCompare(b.departureTime || "")
        ));
      } catch { /* silent */ }
    };

    fetchData();
    fetchToday();
    const iv = setInterval(() => { fetchData(); fetchToday(); }, 30000);
    return () => clearInterval(iv);
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
      <Navbar />
      <main className="flex-1">

        {/* ── HERO ─────────────────────────────────────────────
            Clean, editorial, professional. Search is central.
            No overflow, no broken layouts.
        ──────────────────────────────────────────────────────── */}
        <section className="relative pt-10 pb-14 md:pt-14 md:pb-20 overflow-visible">
          {/* Subtle background gradient with parallax */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-success/[0.03] pointer-events-none" 
            style={{ transform: `translateY(${parallaxOffset}px)` }}
          />
          
          {/* Floating decorative elements */}
          <div className="absolute top-20 right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-10 left-10 w-40 h-40 bg-success/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

          <div className="page-container relative">

            {/* ── Top: headline + subline ── */}
            <div
              className="max-w-2xl mb-7"
              style={{ animation: "heroIn 0.7s cubic-bezier(0.16,1,0.3,1) both" }}
            >
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-[0.15em]">Route-matched carpooling</span>
              </div>

              {/* Headline */}
              <h1
                className="font-display font-extrabold text-foreground tracking-tight leading-[1.05] mb-4"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}
              >
                Find rides that actually{" "}
                <ShinyText
                  text="go your way."
                  color="hsl(var(--primary))"
                  shineColor="hsl(var(--primary-foreground))"
                  speed={4}
                  delay={1}
                  spread={100}
                  className="font-extrabold"
                />
              </h1>

              <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg">
                We match you with drivers sharing your exact route — not just nearby. Pay only for the distance you travel.
              </p>
            </div>

            {/* ── Search bar — full width, prominent, overflow visible so dropdown shows ── */}
            <div
              className="mb-7 relative"
              style={{ animation: "heroIn 0.7s 80ms cubic-bezier(0.16,1,0.3,1) both", zIndex: 10 }}
            >
              <SearchModule />
            </div>

            {/* ── Trust strip + popular routes ── */}
            <div
              className="flex flex-wrap items-center gap-x-5 gap-y-3"
              style={{ animation: "heroIn 0.7s 160ms cubic-bezier(0.16,1,0.3,1) both" }}
            >
              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Shield className="h-3.5 w-3.5 text-success shrink-0" />
                  Verified drivers
                </span>
                <span className="text-border select-none">·</span>
                <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Zap className="h-3.5 w-3.5 text-warning shrink-0" />
                  Instant booking
                </span>
                <span className="text-border select-none">·</span>
                <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  No booking fees
                </span>
                <span className="text-border select-none">·</span>
                <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning shrink-0" />
                  New platform launching
                </span>
              </div>

              {/* Popular routes — clicking navigates to search */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground hidden sm:block">Popular:</span>
                {[
                  { label: "Mumbai → Pune", from: "Mumbai", to: "Pune", fromLat: 19.076, fromLng: 72.877, toLat: 18.520, toLng: 73.856 },
                  { label: "Delhi → Jaipur", from: "Delhi", to: "Jaipur", fromLat: 28.613, fromLng: 77.209, toLat: 26.912, toLng: 75.787 },
                  { label: "Bangalore → Chennai", from: "Bangalore", to: "Chennai", fromLat: 12.971, fromLng: 77.594, toLat: 13.082, toLng: 80.270 },
                ].map((route, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/search?from=${encodeURIComponent(route.from)}&fromLat=${route.fromLat}&fromLng=${route.fromLng}&to=${encodeURIComponent(route.to)}&toLat=${route.toLat}&toLng=${route.toLng}&passengers=1`)}
                    className="text-xs px-3 py-1.5 rounded-full bg-accent hover:bg-accent/70 text-foreground font-medium transition-all duration-200 border border-border hover:border-foreground/20 hover:scale-105 active:scale-95"
                  >
                    {route.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <style>{`
            @keyframes heroIn {
              from { opacity: 0; transform: translateY(16px); }
              to   { opacity: 1; transform: none; }
            }
          `}</style>
        </section>

        {/* ── TODAY'S RIDES ─────────────────────────────────── */}
        {user && todayRides.length > 0 && (
          <section className="py-10 border-y border-border bg-card">
            <div className="page-container">
              <Reveal>
                <div className="flex items-center gap-3 mb-6">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-semibold text-xl text-foreground">Today's schedule</h2>
                  <span className="text-sm text-muted-foreground">— {todayRides.length} ride{todayRides.length > 1 ? "s" : ""}</span>
                </div>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {todayRides.map((ride: any, i) => (
                  <Reveal key={ride._id} delay={i * 60}>
                    <button
                      onClick={() => navigate(`/rides/${ride._id}`)}
                      className="card card-interactive p-5 text-left w-full"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="font-mono font-bold text-2xl text-foreground">{ride.departureTime || "—"}</div>
                          <span className={`badge mt-1.5 ${ride._isBooking ? "badge-neutral" : "badge-primary"}`}>
                            {ride._isBooking ? "Passenger" : "Driver"}
                          </span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <div className="h-2 w-2 rounded-full bg-success shrink-0" />
                          <span className="truncate">{ride.from?.name || "Start"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                          <span className="truncate">{ride.to?.name || "End"}</span>
                        </div>
                      </div>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── AVAILABLE RIDES ───────────────────────────────── */}
        <section className="py-16 md:py-24">
          <div className="page-container">
            <Reveal className="flex items-end justify-between mb-10">
              <div>
                <h2 className="font-display font-bold text-3xl text-foreground mb-1">Available rides</h2>
                <p className="text-muted-foreground text-sm">
                  {loading ? "Loading…" : `${recentRides.length} rides departing soon`}
                </p>
              </div>
              <Link to="/search" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group">
                View all <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Reveal>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-52 rounded-2xl bg-accent animate-pulse" />
                ))}
              </div>
            ) : recentRides.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recentRides.map((ride, i) => (
                  <Reveal key={ride._id} delay={i * 50}>
                    <RideCard ride={ride} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <Reveal>
                <div className="card text-center py-16 px-8">
                  <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
                    <Car className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-display font-semibold text-xl text-foreground mb-2">No rides yet</h3>
                  <p className="text-muted-foreground mb-7 max-w-xs mx-auto text-sm">Be the first to offer a ride</p>
                  <Link to="/offer-ride" className="btn btn-primary btn-md inline-flex">
                    Offer a ride <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Reveal>
            )}

            <div className="sm:hidden mt-6 text-center">
              <Link to="/search" className="text-sm font-semibold text-primary">View all rides →</Link>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS — horizontal timeline ────────────── */}
        <section className="py-16 md:py-24 bg-card border-y border-border">
          <div className="page-container">
            <Reveal className="mb-10">
              <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">How it works</h2>
              <p className="text-muted-foreground max-w-lg">Three steps from search to seat</p>
            </Reveal>

            {/* Ticker strip — subtle trust signals */}
            <div className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8 border-y border-border py-3 bg-muted/20">
              <MarqueeTicker
                speed={48}
                items={[
                  { text: "Route-matched, not just nearby", icon: <MapPin className="h-3.5 w-3.5" /> },
                  { text: "Verified drivers only", icon: <Shield className="h-3.5 w-3.5" /> },
                  { text: "No booking fees, ever", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
                  { text: "Instant seat confirmation", icon: <Zap className="h-3.5 w-3.5" /> },
                  { text: "Pay only for your segment", icon: <IndianRupee className="h-3.5 w-3.5" /> },
                  { text: "Lower emissions together", icon: <Leaf className="h-3.5 w-3.5" /> },
                  { text: "In-app driver chat", icon: <MessageCircle className="h-3.5 w-3.5" /> },
                  { text: "60%+ road overlap required", icon: <Navigation className="h-3.5 w-3.5" /> },
                ]}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-0 relative">
              {/* Connector line — desktop only */}
              <div className="hidden md:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-border" />

              {[
                { n: "01", icon: MapPin, title: "Enter your route", desc: "Pickup and drop. We find rides with 60%+ actual road overlap — not straight-line guesses.", color: "bg-primary text-primary-foreground" },
                { n: "02", icon: Users, title: "Pick your driver", desc: "Real ratings, verified ID, exact pickup point on the map. No surprises.", color: "bg-foreground text-background" },
                { n: "03", icon: CheckCircle2, title: "Book and go", desc: "One tap to reserve. Chat with your driver. Rate when you arrive.", color: "bg-success text-success-foreground" },
              ].map((step, i) => (
                <Reveal key={step.n} delay={i * 100} className="relative px-0 md:px-8 mb-10 md:mb-0">
                  <div className={`h-16 w-16 rounded-2xl ${step.color} flex items-center justify-center mb-6 relative z-10`}>
                    <step.icon className="h-7 w-7" />
                  </div>
                  <div className="text-5xl font-display font-bold text-border/60 mb-2 leading-none">{step.n}</div>
                  <h3 className="font-display font-semibold text-xl text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES — clean grid layout ────────────────────── */}
        <section className="py-16 md:py-24">
          <div className="page-container">
            <Reveal className="mb-14">
              <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">Built different</h2>
              <p className="text-muted-foreground max-w-lg">Not another ride-hailing app. A smarter way to share the road.</p>
            </Reveal>

            {/* Big feature + 2 small */}
            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <Reveal from="left" className="md:row-span-2">
                <div className="card h-full p-8 md:p-10 flex flex-col">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Navigation className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-2xl text-foreground mb-4">Route-first matching</h3>
                  <p className="text-muted-foreground leading-relaxed mb-8 flex-1">
                    We use OSRM road routing — not straight-line distance — to find rides that genuinely share your path. You only pay for the segment you actually travel.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "60%+ route overlap required",
                      "Proportional pricing per segment",
                      "Accurate pickup & drop on the map",
                    ].map(item => (
                      <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal from="right">
                <div className="card p-7 card-hover">
                  <div className="h-11 w-11 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                    <Shield className="h-5 w-5 text-success" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">Verified, not just rated</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Every driver uploads their license and RC. Our OCR system verifies them — not just a checkbox.
                  </p>
                </div>
              </Reveal>

              <Reveal from="right" delay={80}>
                <div className="card p-7 card-hover">
                  <div className="h-11 w-11 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
                    <Zap className="h-5 w-5 text-warning" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">Instant, no approval wait</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Book your seat in one tap. Chat with the driver directly. No back-and-forth approval loops.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* 3 small cards */}
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { icon: MessageCircle, title: "In-app chat", desc: "Coordinate pickup details in real time" },
                { icon: IndianRupee, title: "Pay your share", desc: "Only for the distance you actually travel" },
                { icon: Leaf, title: "Lower emissions", desc: "Every shared seat is one less car on the road" },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 60}>
                  <div className="card p-6 card-hover">
                    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center mb-4">
                      <f.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <h4 className="font-display font-semibold text-foreground mb-1.5">{f.title}</h4>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── NUMBERS — only show what's real ──────────────── */}
        <section className="py-16 md:py-20 bg-primary relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary-foreground rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-foreground rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          </div>
          
          <div className="page-container relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-0 md:divide-x divide-primary-foreground/20">
              {[
                { value: "60%+", label: "Route overlap required" },
                { value: "New", label: "Platform launching" },
                { value: "Free", label: "No booking fees" },
              ].map((s, i) => (
                <Reveal key={s.label} delay={i * 60} className="text-center md:px-8">
                  <div className="font-display font-bold text-4xl md:text-5xl text-primary-foreground mb-2 hover:scale-110 transition-transform duration-300">{s.value}</div>
                  <div className="text-sm text-primary-foreground/70">{s.label}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── ENVIRONMENTAL IMPACT ──────────────────────────── */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-success/5 to-primary/5">
          <div className="page-container">
            <Reveal className="text-center max-w-2xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-bold uppercase tracking-widest">
                <Leaf className="h-3.5 w-3.5" />
                Environmental Impact
              </div>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">
                Every shared ride makes a difference
              </h2>
              <p className="text-muted-foreground">Join thousands of commuters reducing their carbon footprint</p>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { 
                  icon: Leaf, 
                  value: "75%", 
                  label: "Less CO₂ emissions", 
                  desc: "When 3 people share one car instead of driving separately",
                  color: "text-success"
                },
                { 
                  icon: Car, 
                  value: "2/3", 
                  label: "Fewer cars on road", 
                  desc: "Reducing traffic congestion in urban areas",
                  color: "text-primary"
                },
                { 
                  icon: TrendingUp, 
                  value: "60%", 
                  label: "Fuel cost savings", 
                  desc: "Split costs mean everyone saves money",
                  color: "text-warning"
                },
              ].map((item, i) => (
                <Reveal key={item.label} delay={i * 80}>
                  <div className="card p-8 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                    <div className={`h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300 ${item.color}`}>
                      <item.icon className="h-8 w-8" />
                    </div>
                    <div className="font-display font-bold text-4xl text-foreground mb-2">{item.value}</div>
                    <div className="font-semibold text-foreground mb-2">{item.label}</div>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── DRIVER CTA ────────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-card border-y border-border">
          <div className="page-container">
            <div className="card overflow-hidden">
              <div className="grid md:grid-cols-2">
                <Reveal from="left" className="p-8 md:p-12 flex flex-col justify-center">
                  <div className="badge badge-success w-fit mb-5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Earn while you drive
                  </div>
                  <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
                    Your commute is already paid for.
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-8">
                    You're driving anyway. Share the empty seats, split the fuel cost, and pocket the difference. You set the price, you choose who rides.
                  </p>
                  <ul className="space-y-3 mb-8">
                    {["Set your own price per seat", "Approve or reject passengers", "Earn on routes you already take"].map(item => (
                      <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link to="/offer-ride" className="btn btn-primary btn-lg w-fit group btn-ripple">
                    Offer a ride <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </Reveal>

                <Reveal from="right" className="bg-muted/40 p-8 md:p-12 flex items-center justify-center border-t md:border-t-0 md:border-l border-border">
                  <div className="space-y-4 w-full max-w-xs">
                    {[
                      { label: "How it works", text: "You set the price per seat. Passengers pay you directly. SyncRoute charges no commission." },
                      { label: "You're in control", text: "Accept or reject any booking request. Choose who rides with you." },
                      { label: "Verified passengers", text: "Every passenger has a profile, ratings, and verified contact details." },
                    ].map((item, i) => (
                      <Reveal key={item.label} delay={i * 80}>
                        <div className="p-4 bg-background rounded-xl border border-border hover:border-border/80 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">{item.label}</div>
                          <div className="text-sm text-foreground">{item.text}</div>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>



        {/* ── TESTIMONIALS ──────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-card border-y border-border overflow-hidden">
          <div className="page-container">
            <Reveal className="mb-12">
              <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">What riders say</h2>
              <p className="text-muted-foreground">Real experiences from our early community</p>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  name: "Priya S.", city: "Hyderabad → Secunderabad",
                  text: "Found a ride that matched my exact route. Saved ₹180 compared to an auto. The driver was verified and on time.",
                  rating: 5, initials: "PS",
                },
                {
                  name: "Rahul M.", city: "Bangalore → Electronic City",
                  text: "I offer rides on my daily commute. Made back my fuel cost every week. The booking system is super clean.",
                  rating: 5, initials: "RM",
                },
                {
                  name: "Ananya K.", city: "Mumbai → Pune",
                  text: "The route-matching is genuinely different. Not just 'nearby' — it actually checks if the driver goes my way.",
                  rating: 5, initials: "AK",
                },
              ].map((t, i) => (
                <Reveal key={t.name} delay={i * 80}>
                  <div className="testimonial-card h-full flex flex-col">
                    <Quote className="h-6 w-6 text-primary/30 mb-4 shrink-0" />
                    <p className="text-sm text-foreground leading-relaxed flex-1 mb-5">"{t.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {t.initials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.city}</div>
                      </div>
                      <div className="ml-auto flex items-center gap-0.5">
                        {Array.from({ length: t.rating }).map((_, j) => (
                          <Star key={j} className="h-3.5 w-3.5 fill-warning text-warning" />
                        ))}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── NUMBERS ───────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-primary">
          <div className="page-container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x divide-primary-foreground/20">
              {[
                { value: "60%+", label: "Route overlap required", icon: Route },
                { value: "₹0", label: "Booking fees, always", icon: IndianRupee },
                { value: "OCR", label: "Document verification", icon: Shield },
                { value: "New", label: "Platform launching", icon: Sparkles },
              ].map((s, i) => (
                <Reveal key={s.label} delay={i * 60} className="text-center md:px-8">
                  <s.icon className="h-6 w-6 text-primary-foreground/50 mx-auto mb-3" />
                  <div className="font-display font-bold text-4xl md:text-5xl text-primary-foreground mb-2 stat-counter">{s.value}</div>
                  <div className="text-sm text-primary-foreground/70">{s.label}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW THE APP WORKS (visual) ────────────────────── */}
        <section className="py-16 md:py-24 bg-card border-y border-border">
          <div className="page-container">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Reveal from="left">
                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest">
                  <Smartphone className="h-3.5 w-3.5" />
                  Smart matching
                </div>
                <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-5">
                  We do the hard work.<br />You just ride.
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  Our OSRM-powered engine calculates actual road overlap — not straight-line distance. You only see rides that genuinely share your path.
                </p>
                <div className="space-y-4">
                  {[
                    { step: "1", title: "Enter your route", desc: "Pickup and drop. We search real road paths." },
                    { step: "2", title: "See matched rides", desc: "Sorted by route overlap, price, and driver rating." },
                    { step: "3", title: "Book in one tap", desc: "Instant or approval-based. Chat with your driver." },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                        {item.step}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{item.title}</div>
                        <div className="text-sm text-muted-foreground">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal from="right">
                <div className="relative">
                  {/* Decorative background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-success/5 rounded-3xl" />
                  <div className="relative p-6 space-y-3">
                    {/* Mock ride card */}
                    <div className="card p-5 shadow-lg">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Hyderabad → Secunderabad</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xl text-foreground">15:00</span>
                            <span className="text-muted-foreground text-sm">→</span>
                            <span className="font-mono text-sm text-muted-foreground">15:44</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-xl text-foreground">₹59</div>
                          <div className="text-xs text-muted-foreground">per seat</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">Y</div>
                          <div>
                            <div className="text-xs font-semibold text-foreground">Yashwanth R.</div>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              <span className="text-[10px] text-muted-foreground">4.9 · 12 trips</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold">100% match</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Instant</span>
                        </div>
                      </div>
                    </div>

                    {/* Mock second card */}
                    <div className="card p-5 opacity-60">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Hyderabad → Secunderabad</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xl text-foreground">16:30</span>
                            <span className="text-muted-foreground text-sm">→</span>
                            <span className="font-mono text-sm text-muted-foreground">17:15</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-xl text-foreground">₹75</div>
                          <div className="text-xs text-muted-foreground">per seat</div>
                        </div>
                      </div>
                    </div>

                    {/* Match badge overlay */}
                    <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 bg-success text-success-foreground text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg whitespace-nowrap">
                      Route matched ✓
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────── */}
        <section className="py-20 md:py-28 relative overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-success/10" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-success/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          
          <div className="page-container relative z-10">
            <Reveal className="text-center max-w-2xl mx-auto">
              <h2 className="font-display font-bold text-3xl md:text-5xl text-foreground mb-5 leading-tight">
                Ready to share the road?
              </h2>
              <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
                Join India's first route-matched carpooling platform. No booking fees. No commission. Just smarter commutes.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link to="/search" className="btn btn-primary btn-xl group btn-ripple hover:shadow-2xl hover:scale-105 transition-all duration-300">
                  Find a ride <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/offer-ride" className="btn btn-outline btn-xl btn-ripple hover:shadow-xl hover:scale-105 transition-all duration-300">
                  Offer a ride
                </Link>
              </div>
              
              {/* Quick stats */}
              <div className="mt-12 pt-8 border-t border-border flex flex-wrap items-center justify-center gap-8">
                <div className="text-center">
                  <div className="font-display font-bold text-2xl text-foreground mb-1">60%+</div>
                  <div className="text-xs text-muted-foreground">Route overlap</div>
                </div>
                <div className="text-center">
                  <div className="font-display font-bold text-2xl text-foreground mb-1">₹0</div>
                  <div className="text-xs text-muted-foreground">Booking fees</div>
                </div>
                <div className="text-center">
                  <div className="font-display font-bold text-2xl text-foreground mb-1">100%</div>
                  <div className="text-xs text-muted-foreground">Verified drivers</div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
};

/* ── Ride preview card ──────────────────────────────────────────── */
function RideCard({ ride }: { ride: any }) {
  const driver = ride.driver || {};

  return (
    <Link to={`/rides/${ride._id}`} className="card card-interactive p-6 group block h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <div className="font-mono font-bold text-2xl text-foreground mb-3 group-hover:text-primary transition-colors">{ride.departureTime || "—"}</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <div className="h-2 w-2 rounded-full bg-success shrink-0 group-hover:scale-125 transition-transform" />
              <span className="truncate">{ride.from?.name || "Origin"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-destructive shrink-0 group-hover:scale-125 transition-transform" />
              <span className="truncate">{ride.to?.name || "Destination"}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display font-bold text-2xl text-foreground group-hover:text-primary transition-colors">₹{ride.price}</div>
          <div className="text-xs text-muted-foreground mt-0.5">/seat</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-2.5">
          <UserAvatar photo={driver.photo} name={driver.name} size="sm" className="ring-2 ring-background group-hover:ring-primary/20 transition-all" />
          <div>
            <div className="text-sm font-semibold text-foreground leading-none">{driver.name?.split(" ")[0] || "Driver"}</div>
            {(driver.reviewStats?.totalReviews > 0 || driver.reliabilityScore?.totalRatings > 0) && (
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="h-3 w-3 fill-warning text-warning" />
                <span className="text-xs text-muted-foreground">
                  {(driver.reviewStats?.avgStars || driver.reliabilityScore?.avgRating)?.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          <span>{ride.availableSeats} left</span>
          <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

export default Index;
