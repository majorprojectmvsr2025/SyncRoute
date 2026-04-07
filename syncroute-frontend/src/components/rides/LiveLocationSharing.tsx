import { useState, useEffect, useCallback, useRef } from "react";
import { liveTrackingAPI } from "@/lib/api";
import { 
  Share2, 
  MapPin, 
  Copy, 
  MessageCircle,
  StopCircle,
  Loader2,
  Check,
  ExternalLink,
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface LiveLocationSharingProps {
  rideId: string;
  bookingId?: string;
  isRideOngoing: boolean;
  onDeviationDetected?: (deviation: { distance: number; message: string }) => void;
}

interface TrackingSession {
  trackingToken: string;
  trackingUrl: string;
  expiresAt: string;
  sessionId: string;
}

export function LiveLocationSharing({
  rideId,
  bookingId,
  isRideOngoing,
  onDeviationDetected
}: LiveLocationSharingProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for existing session
  useEffect(() => {
    checkExistingSession();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [rideId]);

  const checkExistingSession = async () => {
    try {
      const sessions = await liveTrackingAPI.getMySessions();
      const activeSession = sessions.find((s: any) => s.ride?._id === rideId);
      if (activeSession) {
        setSession({
          trackingToken: activeSession.trackingToken,
          trackingUrl: `${window.location.origin}/track/${activeSession.trackingToken}`,
          expiresAt: activeSession.expiresAt,
          sessionId: activeSession._id
        });
        setIsSharing(true);
        startLocationUpdates(activeSession.trackingToken);
      }
    } catch (error) {
      console.error("Failed to check existing sessions:", error);
    }
  };

  const startSharing = async () => {
    setLoading(true);
    try {
      // Get initial location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });

      const initialLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      const response = await liveTrackingAPI.startTracking(rideId, bookingId, initialLocation);
      setSession(response);
      setIsSharing(true);
      setShowShareMenu(true);
      startLocationUpdates(response.trackingToken);
      toast.success("Live location sharing started");
    } catch (error: any) {
      console.error("Failed to start sharing:", error);
      toast.error(error.response?.data?.message || "Failed to start location sharing");
    } finally {
      setLoading(false);
    }
  };

  const startLocationUpdates = (token: string) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    // Watch position for continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const result = await liveTrackingAPI.updateLocation(
            token,
            position.coords.latitude,
            position.coords.longitude,
            {
              accuracy: position.coords.accuracy,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined
            }
          );
          setLastUpdate(new Date());

          // Check for route deviation
          if (result.deviation?.isDeviated && result.deviation?.alertSent && onDeviationDetected) {
            onDeviationDetected({
              distance: result.deviation.distance,
              message: `Vehicle is ${Math.round(result.deviation.distance / 1000 * 10) / 10}km from route`
            });
          }
        } catch (error) {
          console.error("Failed to update location:", error);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  };

  const stopSharing = async () => {
    if (!session) return;
    
    setLoading(true);
    try {
      await liveTrackingAPI.stopTracking(session.trackingToken);
      
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      setIsSharing(false);
      setSession(null);
      setShowShareMenu(false);
      toast.success("Location sharing stopped");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to stop sharing");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = useCallback(() => {
    if (!session) return;
    navigator.clipboard.writeText(session.trackingUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [session]);

  const shareViaWhatsApp = () => {
    if (!session) return;
    const text = encodeURIComponent(`Track my live location: ${session.trackingUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareViaSMS = () => {
    if (!session) return;
    const text = encodeURIComponent(`Track my live location: ${session.trackingUrl}`);
    window.open(`sms:?body=${text}`, "_blank");
  };

  if (!isRideOngoing) {
    return null;
  }

  return (
    <div className="space-y-3">
      {!isSharing ? (
        <button
          onClick={startSharing}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Share Live Location
        </button>
      ) : (
        <div className="space-y-3">
          {/* Sharing status */}
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Live location sharing active
              </span>
            </div>
            {lastUpdate && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Updated {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
              </span>
            )}
          </div>

          {/* Share options */}
          {showShareMenu && session && (
            <div className="p-4 bg-card border border-border rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground">Share this link with your contacts:</p>
              
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <input
                  type="text"
                  readOnly
                  value={session.trackingUrl}
                  className="flex-1 bg-transparent text-sm outline-none truncate"
                />
                <button
                  onClick={copyLink}
                  className="p-2 hover:bg-background rounded transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={shareViaWhatsApp}
                  className="flex flex-col items-center gap-1 p-3 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                >
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  <span className="text-xs text-green-700 dark:text-green-300">WhatsApp</span>
                </button>
                <button
                  onClick={shareViaSMS}
                  className="flex flex-col items-center gap-1 p-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-xs text-blue-700 dark:text-blue-300">SMS</span>
                </button>
                <button
                  onClick={copyLink}
                  className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Copy className="h-5 w-5 text-gray-600" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Copy</span>
                </button>
              </div>

              <a
                href={session.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-sm text-primary hover:underline"
              >
                Preview tracking page
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Stop sharing button */}
          <button
            onClick={stopSharing}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
            Stop Sharing Location
          </button>
        </div>
      )}
    </div>
  );
}

export default LiveLocationSharing;
