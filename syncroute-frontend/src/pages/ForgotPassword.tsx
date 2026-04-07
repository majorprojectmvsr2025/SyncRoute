import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { authAPI } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      const errAny = err as { response?: { data?: { message?: string } } };
      setError(errAny.response?.data?.message || "Failed to send reset link. Please try again.");
      toast.error("Failed to send reset link");
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

        <h1 className="text-lg font-semibold mb-1">Reset Password</h1>
        <p className="text-sm text-muted-foreground mb-6">We'll send a reset link to your email address</p>

        {sent ? (
          <div className="px-4 py-5 border border-green-500/30 bg-green-500/5 rounded-xl text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-sm mb-1">Reset link sent</p>
            <p className="text-xs text-muted-foreground">
              Check your email for instructions. The link expires in 1 hour.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              (In development, check the server console for the Ethereal preview URL)
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Email Address
              </label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 text-sm bg-transparent border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring transition-system"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-sm transition-system hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
