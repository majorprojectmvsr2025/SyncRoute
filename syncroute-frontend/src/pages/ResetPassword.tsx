import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
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
        <div className="w-full max-w-sm text-center">
          <div className="h-14 w-14 rounded-sm border border-border flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold mb-2">Invalid Reset Link</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 rounded-sm hover:opacity-90 transition-system"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
      toast.success("Password reset successful!");
      setTimeout(() => navigate("/sign-in"), 2000);
    } catch (err: unknown) {
      const errAny = err as { response?: { data?: { message?: string } } };
      setError(errAny.response?.data?.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-7 w-7 bg-primary rounded-sm flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">SR</span>
          </div>
          <span className="font-semibold text-sm">SyncRoute</span>
        </div>

        <Link to="/sign-in" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-system mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to Sign In
        </Link>

        <h1 className="text-lg font-semibold mb-1">Set New Password</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter your new password below</p>

        {success ? (
          <div className="px-4 py-5 border border-green-500/30 bg-green-500/5 rounded-sm text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-sm mb-1">Password reset successful</p>
            <p className="text-xs text-muted-foreground">Redirecting you to sign in...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">New Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-10 text-sm bg-transparent border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring transition-system"
                  placeholder="Min. 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Confirm Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 text-sm bg-transparent border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring transition-system"
                  placeholder="Repeat password"
                  required
                />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-sm transition-system hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
