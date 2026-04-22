import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, Eye, EyeOff, Lock, CheckCircle, ArrowRight } from "lucide-react";
import { authAPI } from "@/lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="card p-10 text-center max-w-sm w-full">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground mb-2">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground mb-7">This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-md inline-flex">
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
      toast.success("Password reset successful!");
      setTimeout(() => navigate("/sign-in"), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password. The link may have expired.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-10 group">
          <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="stroke-primary-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-display font-bold text-lg text-foreground">SyncRoute</span>
        </Link>

        <Link to="/sign-in" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <h1 className="font-display font-bold text-3xl text-foreground mb-1.5">Set new password</h1>
        <p className="text-muted-foreground mb-8">Enter your new password below</p>

        {success ? (
          <div className="card p-8 text-center animate-in-scale">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <h2 className="font-display font-semibold text-xl text-foreground mb-2">Password reset!</h2>
            <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-2">New password</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)} className="input pr-12"
                  placeholder="Min. 6 characters" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-semibold text-foreground mb-2">Confirm password</label>
              <input id="confirm" type={showPassword ? "text" : "password"} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} className="input"
                placeholder="Repeat password" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Resetting…</> : <>Reset password <ArrowRight className="h-5 w-5" /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
