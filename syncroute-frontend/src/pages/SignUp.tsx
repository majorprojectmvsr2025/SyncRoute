import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";

const STRENGTH = [
  { label: "Too short", color: "bg-destructive", w: "w-1/4" },
  { label: "Weak",      color: "bg-warning",     w: "w-2/4" },
  { label: "Good",      color: "bg-warning",      w: "w-3/4" },
  { label: "Strong",    color: "bg-success",      w: "w-full" },
];

function passwordStrength(p: string) {
  if (p.length < 6) return 0;
  let score = 1;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) score++;
  return score;
}

export default function SignUp() {
  const navigate = useNavigate();
  const { register, googleLogin } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        await googleLogin({ email: data.email, name: data.name, googleId: data.sub, photo: data.picture });
        navigate("/");
      } catch { toast.error("Google sign-up failed"); }
      finally { setGoogleLoading(false); }
    },
    onError: () => toast.error("Google sign-up failed"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email || !password) { setError("All fields are required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      await register({ name: name.trim(), email, password, phone, role: "passenger" });
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  const strength = password.length > 0 ? passwordStrength(password) : -1;
  const strengthInfo = strength >= 0 ? STRENGTH[strength] : null;

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Form ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12 overflow-y-auto">
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

          <h1 className="font-display font-bold text-3xl text-foreground mb-1.5">Create your account</h1>
          <p className="text-muted-foreground mb-8">Start sharing rides in minutes</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl border-l-4 border-destructive bg-destructive/5">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-2">Full name</label>
              <input
                id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                className="input" placeholder="Your full name" autoComplete="name" required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">Email address</label>
              <input
                id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@example.com" autoComplete="email" required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-foreground mb-2">
                Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <input
                id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="input" placeholder="+91 XXXXX XXXXX" autoComplete="tel"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-2">Password</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)} className="input pr-12"
                  placeholder="At least 6 characters" autoComplete="new-password" required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {strengthInfo && (
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-400 ${strengthInfo.color} ${strengthInfo.w}`} />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{strengthInfo.label}</span>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-2">
              {loading
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Creating account…</>
                : <>Create account <ArrowRight className="h-5 w-5" /></>
              }
            </button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-sm text-muted-foreground font-medium">Or</span>
            </div>
          </div>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
            <button type="button" onClick={() => handleGoogleLogin()} disabled={googleLoading}
              className="btn btn-outline btn-lg w-full">
              {googleLoading
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Signing up…</>
                : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )
              }
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground">
                Google Sign-Up not configured.{" "}
                <code className="text-foreground font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> missing.
              </p>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/sign-in" className="font-semibold text-primary hover:text-primary/80 transition-colors">Sign in</Link>
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            By signing up you agree to our{" "}
            <Link to="#" className="underline underline-offset-2 hover:text-foreground transition-colors">Terms</Link>
            {" "}and{" "}
            <Link to="#" className="underline underline-offset-2 hover:text-foreground transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>

      {/* ── Right panel — desktop only ────────────────────── */}
      <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] bg-primary flex-col justify-between p-12 xl:p-16 relative overflow-hidden">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(hsl(0 0% 100% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        <div className="relative z-10">
          <div className="h-10 w-10 bg-primary-foreground/10 rounded-xl flex items-center justify-center mb-12">
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="stroke-primary-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h2 className="font-display font-bold text-3xl text-primary-foreground mb-6 leading-tight">
            The smarter way<br />to share the road
          </h2>
          <p className="text-primary-foreground/75 text-base leading-relaxed mb-12">
            Route-matched carpooling that connects you with drivers actually going your way.
          </p>

          <div className="space-y-5">
            {[
              { stat: "60%+", desc: "Route overlap required for every match" },
              { stat: "4.8★", desc: "Average driver rating across the platform" },
              { stat: "₹450", desc: "Average earnings per trip for drivers" },
            ].map(item => (
              <div key={item.stat} className="flex items-center gap-4 p-4 bg-primary-foreground/8 rounded-xl border border-primary-foreground/10">
                <div className="font-display font-bold text-2xl text-primary-foreground w-20 shrink-0">{item.stat}</div>
                <div className="text-sm text-primary-foreground/75">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/40 mt-8">
          © {new Date().getFullYear()} SyncRoute Technologies
        </p>
      </div>
    </div>
  );
}
