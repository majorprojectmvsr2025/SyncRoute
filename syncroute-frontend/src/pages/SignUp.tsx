import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { 
      setError("All fields are required."); 
      return; 
    }
    if (password.length < 6) { 
      setError("Password must be at least 6 characters."); 
      return; 
    }
    
    setLoading(true);
    setError("");
    
    try {
      await register({ name, email, password, phone, role: "passenger" });
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
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

        <h1 className="text-lg font-semibold mb-1">Create Account</h1>
        <p className="text-sm text-muted-foreground mb-6">Join the network</p>

        {error && (
          <div className="mb-4 px-3 py-2 border border-destructive/30 bg-destructive/5 text-destructive text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-ring transition-system" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-ring transition-system" placeholder="user@example.com" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Phone (Optional)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-transparent border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-ring transition-system" placeholder="+49 123 456 7890" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 text-sm bg-transparent border border-border rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-ring transition-system" 
                placeholder="Min. 6 characters" 
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
          <button type="submit" disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg transition-system hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {/* ── Google Sign-Up ── */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 text-xs text-muted-foreground">or</span>
          </div>
        </div>
        {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
          <GoogleLogin
            onSuccess={async (cred) => {
              try {
                const decoded: any = JSON.parse(atob(cred.credential!.split(".")[1]));
                await googleLogin({
                  email: decoded.email,
                  name: decoded.name,
                  googleId: decoded.sub,
                  photo: decoded.picture,
                });
                navigate("/");
              } catch {
                toast.error("Google sign-up failed");
              }
            }}
            onError={() => toast.error("Google sign-up failed")}
            width="100%"
            theme="outline"
            size="large"
            text="signup_with"
          />
        ) : (
          <div className="text-xs text-center text-muted-foreground border border-border rounded-lg py-3 px-4">
            Google Sign-Up not configured — add <code className="text-foreground font-mono">VITE_GOOGLE_CLIENT_ID</code> to your <code className="text-foreground font-mono">.env</code> file.
          </div>
        )}

        <p className="mt-6 text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/sign-in" className="text-primary hover:underline font-medium">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
