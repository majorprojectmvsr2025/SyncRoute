import { useState, useEffect, useCallback } from "react";
import { MapPin, Navigation, Clock, X, Share2, Loader2 } from "lucide-react";
import { messageAPI, type LocationMessage } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface ChatLocationMessageProps {
  message: LocationMessage;
  isOwn: boolean;
  onStopSharing?: () => void;
}

export function ChatLocationMessage({ message, isOwn, onStopSharing }: ChatLocationMessageProps) {
  const [coords, setCoords] = useState<[number, number] | null>(
    message.location?.coordinates || null
  );
  const [isLive, setIsLive] = useState(message.location?.isLive || false);
  const [expired, setExpired] = useState(message.locationExpired || false);
  const [lastUpdated, setLastUpdated] = useState(message.location?.lastUpdated);
  const [eta, setEta] = useState({
    distance: message.location?.snapshot?.distanceRemaining,
    minutes: message.location?.snapshot?.etaMinutes,
  });

  // Listen for location updates via socket
  useEffect(() => {
    if (!isLive || expired) return;

    const handleLocationUpdate = (data: {
      messageId: string;
      coordinates: { lat: number; lng: number };
      distanceRemaining?: number;
      etaMinutes?: number;
      lastUpdated: string;
    }) => {
      if (data.messageId === message._id) {
        setCoords([data.coordinates.lng, data.coordinates.lat]);
        setLastUpdated(data.lastUpdated);
        setEta({
          distance: data.distanceRemaining,
          minutes: data.etaMinutes,
        });
      }
    };

    const handleLocationStopped = (data: { messageId: string }) => {
      if (data.messageId === message._id) {
        setIsLive(false);
        setExpired(true);
      }
    };

    // These would be socket listeners in the parent component
    // For now, we'll poll if this is a live location
    if (isLive && !isOwn) {
      const pollInterval = setInterval(async () => {
        try {
          // In production, this would be handled via WebSocket
          // Here we just refresh the message data
        } catch (err) {
          console.error("Failed to update location:", err);
        }
      }, 10000);

      return () => clearInterval(pollInterval);
    }
  }, [message._id, isLive, expired, isOwn]);

  const handleStopSharing = async () => {
    try {
      await messageAPI.stopLocationSharing(message._id);
      setIsLive(false);
      setExpired(true);
      onStopSharing?.();
    } catch (err) {
      console.error("Failed to stop sharing:", err);
    }
  };

  const openInMaps = () => {
    if (coords) {
      const [lng, lat] = coords;
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    }
  };

  const formatDistance = (meters?: number) => {
    if (!meters) return null;
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div
      className={`max-w-[85%] rounded-xl overflow-hidden ${
        isOwn
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-muted rounded-bl-sm"
      }`}
    >
      {/* Map Preview */}
      <div className="relative h-32 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30">
        {coords && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Static map placeholder - in production, use actual map */}
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 opacity-20">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  </pattern>
                  <rect width="100" height="100" fill="url(#grid)" />
                </svg>
              </div>
              <div className="relative">
                <div className="absolute -translate-x-1/2 -translate-y-full">
                  <div className="relative">
                    <MapPin className="h-8 w-8 text-red-500 drop-shadow-md" fill="currentColor" />
                    {isLive && !expired && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live indicator */}
        {isLive && !expired && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full">
            <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}

        {/* Expired overlay */}
        {expired && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-sm font-medium">Location sharing ended</span>
          </div>
        )}

        {/* Open in maps button */}
        {coords && (
          <button
            onClick={openInMaps}
            className="absolute bottom-2 right-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-xs font-medium px-2 py-1 rounded shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
          >
            <Navigation className="h-3 w-3" />
            Open in Maps
          </button>
        )}
      </div>

      {/* Info Section */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className={`h-4 w-4 ${isOwn ? "text-white/80" : "text-gray-500"}`} />
            <span className={`text-sm font-medium ${isOwn ? "" : "text-gray-800 dark:text-white"}`}>
              {message.location?.snapshot?.address || "Shared Location"}
            </span>
          </div>
        </div>

        {/* ETA info */}
        {(eta.distance || eta.minutes) && !expired && (
          <div className={`flex items-center gap-4 text-xs ${isOwn ? "text-white/70" : "text-gray-500"}`}>
            {eta.distance && (
              <div className="flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                <span>{formatDistance(eta.distance)} away</span>
              </div>
            )}
            {eta.minutes && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>ETA: {eta.minutes} min</span>
              </div>
            )}
          </div>
        )}

        {/* Last updated */}
        <div className={`text-[10px] ${isOwn ? "text-white/60" : "text-gray-400"}`}>
          {lastUpdated ? (
            <>Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}</>
          ) : (
            formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
          )}
        </div>

        {/* Stop sharing button (only for sender of live location) */}
        {isOwn && isLive && !expired && (
          <button
            onClick={handleStopSharing}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-100 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <X className="h-3 w-3" />
            Stop Sharing
          </button>
        )}
      </div>
    </div>
  );
}

// Share Location Button Component
interface ShareLocationButtonProps {
  rideId: string;
  receiverId: string;
  onShared?: (message: LocationMessage) => void;
}

export function ShareLocationButton({ rideId, receiverId, onShared }: ShareLocationButtonProps) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setSharing(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address (simplified)
      let address = "Current location";
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${
            import.meta.env.VITE_MAPBOX_TOKEN
          }&limit=1`
        );
        const data = await response.json();
        if (data.features?.[0]?.place_name) {
          address = data.features[0].place_name;
        }
      } catch {
        // Use fallback address
      }

      const message = await messageAPI.shareLocation({
        rideId,
        receiverId,
        coordinates: { lat: latitude, lng: longitude },
        address,
      });

      onShared?.(message);
    } catch (err) {
      console.error("Failed to share location:", err);
      setError("Failed to get location");
    } finally {
      setSharing(false);
    }
  }, [rideId, receiverId, onShared]);

  // Share live location with continuous updates
  const handleShareLive = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setSharing(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address
      let address = "Live location";
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${
            import.meta.env.VITE_MAPBOX_TOKEN
          }&limit=1`
        );
        const data = await response.json();
        if (data.features?.[0]?.place_name) {
          address = data.features[0].place_name;
        }
      } catch {
        // Use fallback address
      }

      // Generate tracking token for live updates
      const trackingToken = `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const message = await messageAPI.shareLocation({
        rideId,
        receiverId,
        coordinates: { lat: latitude, lng: longitude },
        address,
        trackingToken, // This signals live location sharing
      });

      onShared?.(message);
      setShowOptions(false);

      // Start live location updates (every 10 seconds)
      // In a real app, this would be managed by a context/service
    } catch (err) {
      console.error("Failed to share live location:", err);
      setError("Failed to get location");
    } finally {
      setSharing(false);
    }
  }, [rideId, receiverId, onShared]);

  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={sharing}
        title={error || "Share your location"}
        className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
      >
        {sharing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
      </button>

      {/* Location sharing options popup */}
      {showOptions && !sharing && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowOptions(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-lg z-50 w-48 overflow-hidden">
            <button
              onClick={() => {
                handleShare();
                setShowOptions(false);
              }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-accent flex items-center gap-2 transition-colors"
            >
              <MapPin className="h-4 w-4" />
              Share Current Location
            </button>
            <button
              onClick={handleShareLive}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-accent flex items-center gap-2 transition-colors border-t border-border"
            >
              <Navigation className="h-4 w-4 text-green-500" />
              <span className="flex items-center gap-1.5">
                Share Live Location
                <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">LIVE</span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ChatLocationMessage;
