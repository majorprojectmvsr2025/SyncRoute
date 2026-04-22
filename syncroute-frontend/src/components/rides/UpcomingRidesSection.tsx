import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ridesExtendedAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ChevronRight,
  Car,
  Users,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { toast } from "sonner";

interface UpcomingRide {
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
  bookingStatus?: string;
  passengerConfirmed?: boolean;
  rideConfirmation?: {
    driverConfirmed?: boolean;
    passengerConfirmations?: { passenger: string; confirmedAt: string }[];
  };
}

export function UpcomingRidesSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [upcomingRides, setUpcomingRides] = useState<{
    asDriver: UpcomingRide[];
    asPassenger: UpcomingRide[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadUpcomingRides();
  }, [user]);

  const loadUpcomingRides = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await ridesExtendedAPI.getUpcoming();
      setUpcomingRides(data);
    } catch (error) {
      console.error("Failed to load upcoming rides:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDriver = async (rideId: string) => {
    setConfirming(rideId);
    try {
      await ridesExtendedAPI.confirmStartDriver(rideId);
      toast.success("Ride start confirmed!");
      loadUpcomingRides();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to confirm");
    } finally {
      setConfirming(null);
    }
  };

  const handleConfirmPassenger = async (rideId: string, bookingId: string) => {
    setConfirming(rideId);
    try {
      await ridesExtendedAPI.confirmStartPassenger(rideId, bookingId);
      toast.success("Ride start confirmed!");
      loadUpcomingRides();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to confirm");
    } finally {
      setConfirming(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const allRides = [
    ...(upcomingRides?.asDriver || []).map(r => ({ ...r, role: "driver" as const })),
    ...(upcomingRides?.asPassenger || []).map(r => ({ ...r, role: "passenger" as const })),
  ].sort((a, b) => {
    // Sort by date and time
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.departureTime.localeCompare(b.departureTime);
  });

  if (!user || loading) {
    return null;
  }

  if (allRides.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Upcoming Rides</h2>
        <span className="text-sm text-muted-foreground">{allRides.length} ride{allRides.length > 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-3">
        {allRides.slice(0, 5).map((ride) => {
          const isTodayRide = isToday(parseISO(ride.date));
          const isDriver = ride.role === "driver";
          
          // Check confirmation status
          const driverConfirmed = ride.rideConfirmation?.driverConfirmed;
          const passengerConfirmed = ride.passengerConfirmed || 
            ride.rideConfirmation?.passengerConfirmations?.some(
              c => c.passenger === user?._id
            );
          
          const canConfirm = isTodayRide && (
            (isDriver && !driverConfirmed) || 
            (!isDriver && !passengerConfirmed)
          );

          return (
            <div 
              key={ride._id}
              className="rounded-xl border border-border bg-card hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div 
                onClick={() => navigate(`/ride/${ride._id}`)}
                className="p-4 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  {/* Date/Time */}
                  <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg shrink-0 ${
                    isTodayRide 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    <span className="text-xs font-medium uppercase">{formatDate(ride.date).split(",")[0]}</span>
                    <span className="text-lg font-bold">{ride.departureTime}</span>
                  </div>

                  {/* Route info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        isDriver 
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      }`}>
                        {isDriver ? "Driver" : "Passenger"}
                      </span>
                      {isTodayRide && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium truncate block">{ride.from?.name}</span>
                      <span className="text-muted-foreground text-xs">→ {ride.to?.name}</span>
                    </div>
                  </div>

                  {/* Status & Arrow */}
                  <div className="flex items-center gap-2">
                    {isTodayRide && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`flex items-center gap-1 text-[10px] ${
                          driverConfirmed ? "text-green-600" : "text-muted-foreground"
                        }`}>
                          {driverConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          Driver
                        </span>
                        <span className={`flex items-center gap-1 text-[10px] ${
                          passengerConfirmed ? "text-green-600" : "text-muted-foreground"
                        }`}>
                          {passengerConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          Passenger
                        </span>
                      </div>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Confirmation button */}
              {canConfirm && (
                <div className="px-4 pb-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDriver) {
                        handleConfirmDriver(ride._id);
                      } else if (ride.bookingId) {
                        handleConfirmPassenger(ride._id, ride.bookingId);
                      }
                    }}
                    disabled={confirming === ride._id}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {confirming === ride._id ? (
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm Ride Start
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allRides.length > 5 && (
        <button 
          onClick={() => navigate("/profile?tab=my-rides")}
          className="w-full mt-3 py-2 text-sm text-primary hover:underline"
        >
          View all {allRides.length} upcoming rides
        </button>
      )}
    </div>
  );
}

export default UpcomingRidesSection;
