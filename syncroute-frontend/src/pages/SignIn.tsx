import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Eye, EyeOff, ArrowRight, Shield, Zap, Star } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || "/";

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const userInfo = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        await googleLogin({ email: userInfo.data.email, name: userInfo.data.name, googleId: userInfo.data.sub, photo: userInfo.data.picture });
        navigate(from, { replace: true });
      } catch { toast.error("Google sign-in failed"); }
      finally { setGoogleLoading(false); }
    },
    onError: () => toast.error("Google sign-in failed"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("All fields are required."); return; }
    setLoading(true); setError("");
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2.5 mb-10 group">
            <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="stroke-primary-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-display font-bold text-lg text-foreground">SyncRoute</span>
          </Link>

          <h1 className="font-display font-bold text-3xl text-foreground mb-1.5">Welcome back</h1>
          <p className="text-muted-foreground mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl border-l-4 border-destructive bg-destructive/5 animate-in-up">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">Email address</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@example.com" autoComplete="email" required />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-foreground">Password</label>
                <Link to="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)} className="input pr-12"
                  placeholder="••••••••" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-2">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="h-5 w-5" /></>}
            </button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-sm text-muted-foreground font-medium">Or continue with</span>
            </div>
          </div>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
            <button type="button" onClick={() => handleGoogleLogin()} disabled={googleLoading}
              className="btn btn-outline btn-lg w-full">
              {googleLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Signing in…</> : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground">
                Google Sign-In not configured. Add <code className="text-foreground font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> to your environment.
              </p>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/sign-up" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>

      {/* Feature side — desktop only */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] bg-primary relative overflow-hidden flex-col justify-center p-12 xl:p-16">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative z-10">
          <h2 className="font-display font-bold text-4xl text-primary-foreground mb-5 leading-tight">
            Travel smarter<br />with SyncRoute
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-12 leading-relaxed">
            Join thousands of travelers sharing rides, splitting costs, and reducing their carbon footprint.
          </p>
          <div className="space-y-5">
            {[
              { icon: Shield, title: "Verified drivers", desc: "Every driver is ID and license verified" },
              { icon: Zap, title: "Instant booking", desc: "Book your seat in seconds, no waiting" },
              { icon: Star, title: "Community trust", desc: "Real ratings from real passengers" },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary-foreground/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-5.5 w-5.5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-foreground mb-0.5">{f.title}</h3>
                  <p className="text-sm text-primary-foreground/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
