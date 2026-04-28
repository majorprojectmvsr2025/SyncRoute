import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { authAPI } from "@/lib/api";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newOtp.every(digit => digit !== "") && index === 5) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    
    // Only accept 6-digit numbers
    if (!/^\d{6}$/.test(pastedData)) {
      toast.error("Please paste a valid 6-digit code");
      return;
    }

    const digits = pastedData.split("");
    setOtp(digits);
    inputRefs.current[5]?.focus();
    
    // Auto-submit
    handleVerify(pastedData);
  };

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join("");
    
    if (code.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authAPI.verifyOTP({ email, otp: code });
      
      if (response.verified && response.token && response.user) {
        // Store token and user data
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));
        
        toast.success("Email verified successfully! Welcome to SyncRoute 🎉");
        
        // Reload the page to trigger AuthContext to fetch user with new token
        window.location.href = "/";
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      
      if (errorData?.expired) {
        setError("OTP has expired. Please request a new one.");
        setCanResend(true);
        setResendTimer(0);
      } else if (errorData?.tooManyAttempts) {
        setError("Too many failed attempts. Please request a new OTP.");
        setCanResend(true);
        setResendTimer(0);
      } else if (errorData?.attemptsRemaining !== undefined) {
        setAttemptsRemaining(errorData.attemptsRemaining);
        setError(errorData.message || `Invalid code. ${errorData.attemptsRemaining} attempts remaining.`);
        // Clear OTP inputs
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setError(errorData?.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;

    setResending(true);
    setError("");

    try {
      await authAPI.resendOTP({ email });
      toast.success("New verification code sent to your email");
      setCanResend(false);
      setResendTimer(60);
      setAttemptsRemaining(5);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No email provided</p>
          <Link to="/sign-up" className="text-primary hover:underline">
            Go to Sign Up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2.5 mb-10 group">
          <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" className="stroke-primary-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-display font-bold text-lg text-foreground">SyncRoute</span>
        </Link>

        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h1 className="font-display font-bold text-3xl text-foreground mb-2 text-center">
          Verify your email
        </h1>
        <p className="text-muted-foreground mb-8 text-center">
          We sent a 6-digit code to<br />
          <span className="font-semibold text-foreground">{email}</span>
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl border-l-4 border-destructive bg-destructive/5">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* OTP Input */}
        <div className="mb-6">
          <div className="flex gap-3 justify-center" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                disabled={loading}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {attemptsRemaining} {attemptsRemaining === 1 ? "attempt" : "attempts"} remaining
          </p>
        </div>

        {/* Verify Button */}
        <button
          onClick={() => handleVerify()}
          disabled={loading || otp.some(d => !d)}
          className="btn btn-primary btn-lg w-full mb-4"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify Email"
          )}
        </button>

        {/* Resend Button */}
        <button
          onClick={handleResend}
          disabled={!canResend || resending}
          className="btn btn-ghost w-full"
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : canResend ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Resend code
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Resend in {resendTimer}s
            </>
          )}
        </button>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign up
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 rounded-xl bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground text-center">
            Didn't receive the code? Check your spam folder or click resend.
            <br />
            Code expires in 10 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
