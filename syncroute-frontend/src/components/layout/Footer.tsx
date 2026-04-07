import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 bg-foreground rounded-lg flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="text-background" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="font-bold text-sm">SyncRoute</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Share rides, split costs, and travel together. India's trusted carpooling platform.
            </p>
          </div>

          {/* Travel */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Travel</h4>
            <div className="space-y-2">
              <Link to="/" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Find a ride</Link>
              <Link to="/offer-ride" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Offer a ride</Link>
              <Link to="/search" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Search rides</Link>
            </div>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Account</h4>
            <div className="space-y-2">
              <Link to="/sign-in" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
              <Link to="/sign-up" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Create account</Link>
              <Link to="/profile" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">My profile</Link>
              <Link to="/dashboard" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            </div>
          </div>

          {/* Safety */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Safety</h4>
            <div className="space-y-2">
              <span className="block text-sm text-muted-foreground">Verified drivers</span>
              <span className="block text-sm text-muted-foreground">Document verification</span>
              <span className="block text-sm text-muted-foreground">Ratings & reviews</span>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} SyncRoute. All rights reserved.</p>
          <p className="text-xs text-muted-foreground font-mono">v2.4.1</p>
        </div>
      </div>
    </footer>
  );
}
