import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft, Mail, CheckCircle, ArrowRight } from "lucide-react";
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
    setError(""); setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send reset link. Please try again.");
      toast.error("Failed to send reset link");
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

        <h1 className="font-display font-bold text-3xl text-foreground mb-1.5">Reset your password</h1>
        <p className="text-muted-foreground mb-8">We'll send a reset link to your email address</p>

        {sent ? (
          <div className="card p-8 text-center animate-in-scale">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <h2 className="font-display font-semibold text-xl text-foreground mb-2">Check your email</h2>
            <p className="text-sm text-muted-foreground mb-1">
              We sent a reset link to <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">The link expires in 1 hour.</p>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              In development, check the server console for the Ethereal preview URL.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">Email address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input pl-12" placeholder="you@example.com" required />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading || !email.trim()} className="btn btn-primary btn-lg w-full">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Sending…</> : <>Send reset link <ArrowRight className="h-5 w-5" /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
