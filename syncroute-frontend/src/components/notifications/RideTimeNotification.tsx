/**
 * RideTimeNotification — Shows prominent notifications when ride time is approaching
 * Displays 30 min before, at departure time, and prompts for live tracking
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Navigation, Users, X, Bell, MapPin, Play } from "lucide-react";
import { ridesAPI, bookingsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface RideTimeNotificationProps {
  onStartTracking?: (rideId: string) => void;
}

export function RideTimeNotification({ onStartTracking }: RideTimeNotificationProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [upcomingRides, setUpcomingRides] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const checkRides = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [myRides, myBookings] = await Promise.all([
          ridesAPI.getMyRides(),
          bookingsAPI.getMyBookings()
        ]);

        const now = new Date();
        const upcoming: any[] = [];

        // Check rides where user is driver
        myRides
          .filter((r: any) => r.date === today && r.status === "active")
          .forEach((ride: any) => {
            if (!ride.departureTime) return;
            const rideTime = new Date(`${ride.date}T${ride.departureTime}`);
            const diffMin = Math.round((rideTime.getTime() - now.getTime()) / 60000);
            
            if (diffMin > 0 && diffMin <= 30) {
              upcoming.push({
                ...ride,
                role: "driver",
                timeUntil: diffMin,
                isNow: diffMin <= 5
              });
            }
          });

        // Check rides where user is passenger
        myBookings
          .filter((b: any) => 
            b.ride?.date === today && 
            b.status !== "cancelled" && 
            b.ride?.status === "active"
          )
          .forEach((booking: any) => {
            const ride = booking.ride;
            if (!ride?.departureTime) return;
            const rideTime = new Date(`${ride.date}T${ride.departureTime}`);
            const diffMin = Math.round((rideTime.getTime() - now.getTime()) / 60000);
            
            if (diffMin > 0 && diffMin <= 30) {
              upcoming.push({
                ...ride,
                role: "passenger",
                timeUntil: diffMin,
                isNow: diffMin <= 5,
                bookingId: booking._id
              });
            }
          });

        setUpcomingRides(upcoming.filter(r => !dismissed.has(r._id)));
      } catch (error) {
        console.error("Failed to check upcoming rides:", error);
      }
    };

    checkRides();
    const interval = setInterval(checkRides, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [user, dismissed]);

  const handleDismiss = (rideId: string) => {
    setDismissed(prev => new Set(prev).add(rideId));
  };

  const handleStartTracking = (ride: any) => {
    if (onStartTracking) {
      onStartTracking(ride._id);
    } else {
      navigate(`/rides/${ride._id}`);
    }
  };

  if (upcomingRides.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-sm">
      {upcomingRides.map((ride) => (
        <div
          key={ride._id}
          className="bg-card border-2 border-primary/30 rounded-2xl shadow-2xl overflow-hidden animate-slide-down"
          style={{
            animation: "slideDown 0.4s cubic-bezier(0.16,1,0.3,1) both, pulse 2s ease-in-out infinite"
          }}
        >
          {/* Header */}
          <div className={`px-4 py-3 flex items-center justify-between ${
            ride.isNow 
              ? "bg-gradient-to-r from-destructive/20 to-warning/20" 
              : "bg-gradient-to-r from-primary/10 to-primary/5"
          }`}>
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                ride.isNow ? "bg-destructive/20" : "bg-primary/20"
              }`}>
                {ride.isNow ? (
                  <Bell className={`h-4 w-4 ${ride.isNow ? "text-destructive animate-bounce" : "text-primary"}`} />
                ) : (
                  <Clock className="h-4 w-4 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {ride.isNow ? "Ride Starting Now!" : `Ride in ${ride.timeUntil} min`}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  You're the {ride.role}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(ride._id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Route */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-success shrink-0" />
              <span className="font-medium truncate">{ride.from?.name || "Start"}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium truncate">{ride.to?.name || "End"}</span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Departure: {ride.departureTime}</span>
            </div>

            {/* Passenger count for driver */}
            {ride.role === "driver" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>{ride.bookedSeats || 0} passenger{ride.bookedSeats !== 1 ? "s" : ""} booked</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => navigate(`/rides/${ride._id}`)}
                className="flex-1 h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                View Details
              </button>
              {ride.isNow && (
                <button
                  onClick={() => handleStartTracking(ride)}
                  className="flex-1 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Ride
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px hsl(var(--primary) / 0);
          }
        }
      `}</style>
    </div>
  );
}

export default RideTimeNotification;
