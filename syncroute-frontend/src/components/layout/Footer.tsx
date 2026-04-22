import { Link } from "react-router-dom";
import { ArrowRight, Shield, Zap, Star, MapPin, Play } from "lucide-react";

const LINKS = {
  travel: [
    { label: "Find a ride", href: "/" },
    { label: "Offer a ride", href: "/offer-ride" },
    { label: "Search rides", href: "/search" },
  ],
  account: [
    { label: "Sign in", href: "/sign-in" },
    { label: "Create account", href: "/sign-up" },
    { label: "My profile", href: "/profile" },
    { label: "Dashboard", href: "/dashboard" },
  ],
  company: [
    { label: "How it works", href: "#" },
    { label: "Safety", href: "#" },
    { label: "Support", href: "#" },
    { label: "Privacy", href: "#" },
  ],
};

export function Footer() {
  const handleReplayIntro = () => {
    sessionStorage.removeItem("syncroute_intro_seen");
    window.location.href = "/";
  };

  return (
    <footer className="bg-card border-t border-border">
      {/* CTA strip */}
      <div className="border-b border-border">
        <div className="page-container py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="font-display font-semibold text-lg text-foreground mb-1">Ready to travel smarter?</p>
              <p className="text-sm text-muted-foreground">Share rides, split costs, reduce emissions.</p>
            </div>
            <div className="flex gap-3">
              <Link to="/search" className="btn btn-outline btn-md">
                Find a ride
              </Link>
              <Link to="/offer-ride" className="btn btn-primary btn-md">
                Offer a ride <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="page-container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4 group w-fit">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="stroke-primary-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="font-display font-bold text-[17px] text-foreground">SyncRoute</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Intelligent carpooling with route-based matching. Travel together, save together.
            </p>
            <div className="space-y-2">
              {[
                { icon: Shield, label: "Verified drivers" },
                { icon: Zap, label: "Instant booking" },
                { icon: Star, label: "Community ratings" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-brand-accent" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Travel */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Travel</h4>
            <ul className="space-y-2.5">
              {LINKS.travel.map(({ label, href }) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Account</h4>
            <ul className="space-y-2.5">
              {LINKS.account.map(({ label, href }) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Company</h4>
            <ul className="space-y-2.5">
              {LINKS.company.map(({ label, href }) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SyncRoute Technologies. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            {/* Replay intro animation */}
            <button
              onClick={handleReplayIntro}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              title="Replay intro animation"
            >
              <div className="h-5 w-5 rounded-full border border-border group-hover:border-foreground/30 flex items-center justify-center transition-colors">
                <Play className="h-2.5 w-2.5 ml-0.5" />
              </div>
              Replay intro
            </button>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Made in India
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
