import { useState, useEffect } from "react";
import { waitlistAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Bell,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface WaitlistButtonProps {
  rideId: string;
  seats?: number;
  pickupLocation?: { name: string; coordinates: number[] };
  dropLocation?: { name: string; coordinates: number[] };
  onJoined?: () => void;
}

interface WaitlistStatus {
  onWaitlist: boolean;
  position?: number;
  peopleAhead?: number;
  status?: "waiting" | "offered" | "confirmed" | "expired" | "cancelled" | "declined";
  seatsRequested?: number;
  offerExpiresAt?: string;
}

export function WaitlistButton({
  rideId,
  seats = 1,
  pickupLocation,
  dropLocation,
  onJoined
}: WaitlistButtonProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [responding, setResponding] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [rideId]);

  // Countdown timer for offer expiry
  useEffect(() => {
    if (status?.status === "offered" && status?.offerExpiresAt) {
      const timer = setInterval(() => {
        const remaining = Math.max(0, new Date(status.offerExpiresAt!).getTime() - Date.now());
        setCountdown(Math.floor(remaining / 1000));
        if (remaining <= 0) {
          clearInterval(timer);
          loadStatus();
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status?.status, status?.offerExpiresAt]);

  const loadStatus = async () => {
    try {
      const data = await waitlistAPI.getMyStatus(rideId);
      setStatus(data);
      
      // Show offer modal if there's an active offer
      if (data.status === "offered" && !showOfferModal) {
        setShowOfferModal(true);
      }
    } catch (error) {
      console.error("Failed to load waitlist status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    setJoining(true);
    try {
      const result = await waitlistAPI.join(rideId, seats, pickupLocation, dropLocation);
      toast.success(`Added to waitlist! Position: ${result.position}`);
      loadStatus();
      onJoined?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to join waitlist");
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    setJoining(true);
    try {
      await waitlistAPI.leave(rideId);
      toast.success("Removed from waitlist");
      setStatus({ onWaitlist: false });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to leave waitlist");
    } finally {
      setJoining(false);
    }
  };

  const handleAcceptOffer = async () => {
    setResponding(true);
    try {
      const result = await waitlistAPI.acceptOffer(rideId);
      toast.success("Booking confirmed!");
      setShowOfferModal(false);
      loadStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to accept offer");
    } finally {
      setResponding(false);
    }
  };

  const handleDeclineOffer = async () => {
    setResponding(true);
    try {
      await waitlistAPI.declineOffer(rideId);
      toast.info("Offer declined");
      setShowOfferModal(false);
      loadStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to decline offer");
    } finally {
      setResponding(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-12 bg-muted rounded-lg"></div>
      </div>
    );
  }

  return (
    <>
      {status?.onWaitlist ? (
        <div className="space-y-3">
          {/* Waitlist status card */}
          <div className={`p-4 rounded-xl border ${
            status.status === "offered"
              ? "border-green-300 bg-green-50 dark:bg-green-900/20"
              : "border-amber-300 bg-amber-50 dark:bg-amber-900/20"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {status.status === "offered" ? (
                  <Bell className="h-5 w-5 text-green-600 dark:text-green-400 animate-bounce" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
                <span className={`font-medium ${
                  status.status === "offered" 
                    ? "text-green-700 dark:text-green-300" 
                    : "text-amber-700 dark:text-amber-300"
                }`}>
                  {status.status === "offered" ? "Seat Available!" : "On Waitlist"}
                </span>
              </div>
              {status.status !== "offered" && (
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Position #{status.position}
                </span>
              )}
            </div>
            
            {status.status === "offered" && countdown !== null && (
              <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                Confirm within <strong>{formatCountdown(countdown)}</strong>
              </p>
            )}
            
            {status.status !== "offered" && status.peopleAhead !== undefined && status.peopleAhead > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {status.peopleAhead} {status.peopleAhead === 1 ? "person" : "people"} ahead of you
              </p>
            )}
          </div>

          {/* Actions */}
          {status.status === "offered" ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDeclineOffer}
                disabled={responding}
                className="py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptOffer}
                disabled={responding}
                className="py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {responding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Booking
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleLeaveWaitlist}
              disabled={joining}
              className="w-full py-3 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Leave Waitlist
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleJoinWaitlist}
          disabled={joining}
          className="w-full py-3 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-lg font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {joining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Users className="h-4 w-4" />
              Join Waitlist
            </>
          )}
        </button>
      )}

      {/* Offer Modal */}
      {showOfferModal && status?.status === "offered" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-green-600 text-white p-4 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Seat Available!</h3>
                <p className="text-sm text-white/80">
                  Time remaining: {countdown !== null ? formatCountdown(countdown) : "..."}
                </p>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-center">
                A seat is now available on this ride! Confirm within {countdown !== null ? formatCountdown(countdown) : "5 minutes"} to secure your booking.
              </p>

              <div className="bg-muted p-3 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>If you don't confirm in time, the seat will be offered to the next person in the waitlist.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDeclineOffer}
                  disabled={responding}
                  className="py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptOffer}
                  disabled={responding}
                  className="py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {responding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default WaitlistButton;
