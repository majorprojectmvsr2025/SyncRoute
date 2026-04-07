import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
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

  // Get the location they were trying to access before being redirected to login
  const from = (location.state as any)?.from?.pathname || "/";

  // Custom Google Login handler
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        // Get user info from Google
        const userInfo = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        
        await googleLogin({
          email: userInfo.data.email,
          name: userInfo.data.name,
          googleId: userInfo.data.sub,
          photo: userInfo.data.picture,
        });
        navigate(from, { replace: true });
      } catch {
        toast.error("Google sign-in failed");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error("Google sign-in failed");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { 
      setError("All fields are required."); 
      return; 
    }
    
    setLoading(true);
    setError("");
    
    try {
      await login(email, password);
      // Redirect back to the page they were trying to access
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-7 w-7 bg-foreground rounded-lg flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="text-background" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-semibold text-sm">SyncRoute</span>
        </div>

        <h1 className="text-lg font-semibold mb-1">Sign In</h1>
        <p className="text-sm text-muted-foreground mb-6">Access your account</p>

        {error && (
          <div className="mb-4 px-3 py-2 border border-destructive/30 bg-destructive/5 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-ring transition-system"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Password</label>
              <Link to="/forgot-password" className="text-[10px] text-primary hover:underline">Forgot?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 text-sm bg-transparent border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-ring transition-system"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg transition-system hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* ── Google Sign-In ── */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 text-xs text-muted-foreground">or</span>
          </div>
        </div>
        {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={googleLoading}
            className="w-full h-10 bg-transparent border border-border text-foreground text-sm font-medium rounded-lg transition-system hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </button>
        ) : (
          <div className="text-xs text-center text-muted-foreground border border-border rounded-lg py-3 px-4">
            Google Sign-In not configured — add <code className="text-foreground font-mono">VITE_GOOGLE_CLIENT_ID</code> to your <code className="text-foreground font-mono">.env</code> file.
          </div>
        )}

        <p className="mt-6 text-sm text-center text-muted-foreground">
          No account?{" "}
          <Link to="/sign-up" className="text-primary hover:underline font-medium">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
