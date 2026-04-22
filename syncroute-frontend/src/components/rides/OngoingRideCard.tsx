import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ridesExtendedAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { 
  MapPin, 
  Clock, 
  Navigation, 
  MessageCircle,
  AlertTriangle,
  ChevronRight,
  Car,
  Users
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OngoingRideData {
  _id: string;
  from: { name: string };
  to: { name: string };
  date: string;
  departureTime: string;
  driver: {
    _id: string;
    name: string;
    photo?: string;
  };
  vehicleType: string;
  vehicleModel?: string;
  status: string;
  bookingId?: string;
  rideConfirmation?: {
    rideStartedAt?: string;
  };
}

export function OngoingRideCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ongoingRide, setOngoingRide] = useState<{
    asDriver: OngoingRideData | null;
    asPassenger: OngoingRideData | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadOngoingRide();
    // Poll for updates
    const interval = setInterval(loadOngoingRide, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadOngoingRide = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await ridesExtendedAPI.getOngoing();
      setOngoingRide(data);
    } catch (error) {
      console.error("Failed to load ongoing ride:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) {
    return null;
  }

  const ride = ongoingRide?.asDriver || ongoingRide?.asPassenger;
  const isDriver = !!ongoingRide?.asDriver;

  if (!ride) return null;

  const startedAt = ride.rideConfirmation?.rideStartedAt 
    ? new Date(ride.rideConfirmation.rideStartedAt) 
    : null;
  const elapsedMinutes = startedAt 
    ? Math.floor((Date.now() - startedAt.getTime()) / 60000)
    : 0;

  return (
    <div className="mb-6">
      <div 
        onClick={() => navigate(`/ride/${ride._id}`)}
        className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent cursor-pointer hover:shadow-lg transition-all duration-300 group"
      >
        {/* Status indicator pulse */}
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              LIVE
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Ongoing Ride</h3>
            <span className="ml-auto text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {elapsedMinutes > 0 ? `${elapsedMinutes} min` : "Just started"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Route info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="truncate font-medium">{ride.from?.name}</span>
              </div>
              <div className="w-0.5 h-4 bg-border ml-[3px] my-1" />
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="truncate font-medium">{ride.to?.name}</span>
              </div>
            </div>

            {/* Role badge */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              isDriver 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            }`}>
              {isDriver ? (
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" />
                  Driving
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Passenger
                </span>
              )}
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/chat?rideId=${ride._id}`);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
            </button>
            <div className="w-px h-4 bg-border" />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/ride/${ride._id}?sos=true`);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              SOS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OngoingRideCard;
