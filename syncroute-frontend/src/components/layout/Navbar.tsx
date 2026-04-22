import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X, LogOut, Search, MessageSquare, Plus, LayoutDashboard, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Logo } from "@/components/ui/Logo";

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

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate("/sign-in"); };
  const isActive = (href: string) => location.pathname === href;

  const navLinks = [
    { label: "Find a ride", href: "/", icon: Search },
    { label: "Messages", href: "/chat", icon: MessageSquare },
    ...(user ? [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] : []),
  ];

  return (
    <>
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-background border-b border-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link to="/" className="shrink-0 group">
            <Logo size="md" showText={true} className="group-hover:scale-105 transition-transform duration-200" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 ml-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`px-3.5 py-2 text-sm rounded-lg transition-all duration-150 font-medium ${
                  isActive(item.href)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            {user ? (
              <>
                {/* Desktop only */}
                <ThemeToggle className="hidden md:flex" />
                <NotificationBell className="hidden md:flex" />
                <Link
                  to="/offer-ride"
                  className="btn btn-primary btn-sm hidden md:inline-flex"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Offer ride
                </Link>

                <Link
                  to="/profile"
                  className="hidden md:flex h-9 items-center gap-2.5 px-3 rounded-xl border border-border hover:bg-accent transition-all duration-150 text-sm font-medium"
                >
                  {user.photo ? (
                    <img src={user.photo} alt={user.name} className="h-6 w-6 rounded-full object-cover ring-1 ring-border" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{user.name?.[0]?.toUpperCase() || "U"}</span>
                    </div>
                  )}
                  <span className="max-w-[72px] truncate text-foreground">{user.name?.split(" ")[0]}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-accent transition-all duration-150 text-muted-foreground hover:text-foreground"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                {/* Mobile only - just hamburger */}
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl border border-border hover:bg-accent transition-all duration-150"
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
                </button>
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link to="/sign-in" className="hidden md:flex h-9 px-4 items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </Link>
                <Link to="/sign-up" className="btn btn-primary btn-sm hidden md:inline-flex">
                  Sign up
                </Link>

                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl border border-border hover:bg-accent transition-all duration-150"
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden animate-in-fade" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-16 inset-x-0 z-50 md:hidden bg-background border-b border-border shadow-xl animate-in-up max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="page-container py-4 space-y-1">
              {user && (
                <>
                  {/* User profile section */}
                  <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/50 mb-3">
                    {user.photo ? (
                      <img src={user.photo} alt={user.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-border" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                        <span className="text-sm font-bold text-primary">{user.name?.[0]?.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground">View profile</div>
                    </div>
                  </Link>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 px-4 py-2 mb-2">
                    <ThemeToggle />
                    <NotificationBell />
                  </div>

                  <Link to="/offer-ride" className="btn btn-primary btn-md w-full mb-3">
                    <Plus className="h-4 w-4" /> Offer ride
                  </Link>
                </>
              )}
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-border mt-3">
                {user ? (
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link to="/sign-in" className="btn btn-outline btn-md w-full">Sign in</Link>
                    <Link to="/sign-up" className="btn btn-primary btn-md w-full">Sign up</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
