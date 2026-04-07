import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X, User, LogOut, LayoutDashboard, Search, MessageSquare, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/sign-in");
    setMobileOpen(false);
  };

  const isActive = (href: string) => location.pathname === href;

  const navLinks = [
    { label: "Find a ride", href: "/" },
    { label: "Messages", href: "/chat" },
    ...(user ? [{ label: "Dashboard", href: "/dashboard" }] : []),
  ];

  return (
    <header
      className={`sticky top-0 z-50 border-b border-border transition-all duration-200 ${
        scrolled ? "bg-background/95 backdrop-blur-md" : "bg-background"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 bg-foreground rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="text-background" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight hidden sm:block">SyncRoute</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive(item.href)
                  ? "text-foreground font-medium bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          {user && <NotificationBell />}

          {user ? (
            <>
              <Link
                to="/offer-ride"
                className="hidden md:flex h-8 px-4 items-center gap-1.5 text-sm bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Offer ride
              </Link>

              <Link
                to="/profile"
                className="hidden md:flex h-8 px-3 items-center gap-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              >
                {user.photo ? (
                  <img src={user.photo} alt={user.name} className="h-5 w-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center">
                    <span className="text-[10px] font-semibold">
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <span className="max-w-20 truncate">{user.name?.split(" ")[0]}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="hidden md:flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="hidden md:flex h-8 px-3 items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="hidden md:flex h-8 px-4 items-center text-sm bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
              >
                Get started
              </Link>
            </>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="p-3 space-y-1">
            {user && (
              <Link
                to="/offer-ride"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 items-center justify-center gap-1.5 px-3 text-sm bg-foreground text-background rounded-lg font-medium mb-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Offer ride
              </Link>
            )}
            {navLinks.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center px-3 py-2.5 text-sm rounded-md transition-colors ${
                  isActive(item.href)
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-md transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  {user.name}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-md transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-1 pt-1 border-t border-border mt-1">
                <Link
                  to="/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-10 items-center px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-md transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/sign-up"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-10 items-center px-3 text-sm bg-foreground text-background rounded-lg font-medium"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
