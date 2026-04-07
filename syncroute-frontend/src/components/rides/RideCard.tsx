import { Link } from "react-router-dom";
import { Star, Zap, Shield, Users, Calendar, UserCircle, ShieldCheck, Sparkles, Info } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface PersonalizationInfo {
  score?: number;
  isRecommended?: boolean;
  isPersonalized?: boolean;
  reasons?: string[];
  breakdown?: {
    route: number;
    time: number;
    driver: number;
    vehicle: number;
    price: number;
    comfort: number;
    bookingStyle: number;
  };
}

interface RideCardProps {
  ride: any;
  searchCoords?: { fromLat: number; fromLng: number; toLat: number; toLng: number };
}

function computeArrival(
  departureTime: string,
  durationSeconds?: number,
  routeCoords?: [number, number][]
): { arrival: string; duration: string } | null {
  if (!departureTime) return null;

  let totalMinutes = 0;

  if (durationSeconds && durationSeconds > 0) {
    // OSRM duration + 1.6x traffic multiplier for Indian roads
    totalMinutes = Math.round((durationSeconds * 1.6) / 60);
  } else if (routeCoords && routeCoords.length >= 2) {
    let totalDist = 0;
    const R = 6371;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const [lon1, lat1] = routeCoords[i];
      const [lon2, lat2] = routeCoords[i + 1];
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    totalMinutes = Math.round((totalDist / 28) * 60);
  } else {
    return null;
  }

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const duration = h > 0 ? (m > 0 ? `~${h}h ${m}m` : `~${h}h`) : `~${m}m`;

  try {
    const [dh, dm] = departureTime.split(":").map(Number);
    const total = (dh * 60 + dm + totalMinutes) % (24 * 60);
    const ah = Math.floor(total / 60);
    const am = total % 60;
    const arrival = `${String(ah).padStart(2, "0")}:${String(am).padStart(2, "0")}`;
    return { arrival, duration };
  } catch {
    return null;
  }
}

export function RideCard({ ride, searchCoords }: RideCardProps) {
  const driver = ride.driver || {};
  const personalization: PersonalizationInfo = ride.personalization || {};
  const [showReasons, setShowReasons] = useState(false);
  
  const initials = driver.name
    ? driver.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const seatsLeft = ride.availableSeats ?? 0;
  const seatsTotal = ride.totalSeats ?? 0;
  const seatsPercent = seatsTotal > 0 ? (seatsLeft / seatsTotal) * 100 : 0;
  const seatsColor = seatsPercent > 50 ? "text-green-600" : seatsPercent > 20 ? "text-amber-500" : "text-red-500";

  const isPartial = ride.overlapDistanceMeters != null && ride.estimatedDistance > 0;
  const effectivePrice = isPartial
    ? Math.max(1, Math.round(ride.price * ride.overlapDistanceMeters / ride.estimatedDistance))
    : ride.price ?? 0;

  const estimate = computeArrival(
    ride.departureTime,
    ride.estimatedDuration,
    ride.routePath?.coordinates
  );

  const arrivalTime = ride.arrivalTime || estimate?.arrival;
  const duration = estimate?.duration;

  const rideUrl = searchCoords
    ? `/rides/${ride._id}?pLat=${searchCoords.fromLat}&pLng=${searchCoords.fromLng}&dLat=${searchCoords.toLat}&dLng=${searchCoords.toLng}`
    : `/rides/${ride._id}`;

  return (
    <Link
      to={rideUrl}
      className={`block px-5 py-4 hover:bg-accent/40 transition-colors relative ${
        personalization.isRecommended ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
    >
      {/* Recommendation Badge */}
      {personalization.isRecommended && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            Recommended for you
          </span>
          {personalization.reasons && personalization.reasons.length > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowReasons(!showReasons);
              }}
              className="p-1 rounded-full hover:bg-accent"
              title="Why recommended?"
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Recommendation Reasons Tooltip */}
      {showReasons && personalization.reasons && personalization.reasons.length > 0 && (
        <div className="absolute top-8 right-2 z-10 bg-popover border border-border rounded-md shadow-lg p-3 max-w-xs">
          <p className="text-xs font-medium text-foreground mb-1.5">Why we recommend this:</p>
          <ul className="space-y-1">
            {personalization.reasons.slice(0, 3).map((reason, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
          {personalization.score && (
            <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
              Match score: {Math.round(personalization.score * 100)}%
            </p>
          )}
        </div>
      )}

      <div className="flex gap-5 items-start">

        {/* Route column */}
        <div className="flex-1 min-w-0">
          {/* Time + City row */}
          <div className="flex items-start gap-3 mb-1">
            <span className="text-base font-semibold tabular-nums shrink-0 w-14 text-right">
              {ride.departureTime || "\u2014"}
            </span>
            <div className="flex items-center gap-2 min-w-0 pt-[3px]">
              <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
              <span className="text-sm font-medium truncate">{ride.from?.name || "Origin"}</span>
            </div>
          </div>

          {/* Connector with duration */}
          <div className="flex gap-3 my-0.5">
            <div className="w-14 shrink-0 flex justify-end">
              {duration && (
                <span className="text-[10px] text-muted-foreground tabular-nums">{duration}</span>
              )}
            </div>
            <div className="ml-[3px] w-px h-5 bg-border" />
          </div>

          {/* Arrival row */}
          <div className="flex items-start gap-3">
            <span className="text-sm tabular-nums shrink-0 w-14 text-right text-muted-foreground">
              {arrivalTime || "\u2014"}
            </span>
            <div className="flex items-center gap-2 min-w-0 pt-[2px]">
              <div className="h-2 w-2 rounded-full border-2 border-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">{ride.to?.name || "Destination"}</span>
            </div>
          </div>

          {/* Date + stops tag */}
          <div className="flex items-center gap-3 mt-3 ml-[68px]">
            {ride.date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {ride.date}
              </span>
            )}
            {ride.stops?.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {ride.stops.length} stop{ride.stops.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Price column */}
        <div className="text-right shrink-0">
          <div className="text-xl font-bold leading-none">{"\u20B9"}{effectivePrice}</div>
          <div className="text-xs text-muted-foreground mt-1">{isPartial ? "for your trip" : "per seat"}</div>
        </div>
      </div>

      {/* Driver row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center gap-2.5">
          <UserAvatar photo={driver.photo} name={driver.name} size="sm" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium leading-none">{driver.name || "Driver"}</span>
              {driver.verified && (
                <Shield className="h-3 w-3 text-primary" />
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {/* Only show rating if driver has actual reviews (Part 4) */}
              {(driver.reviewStats?.totalReviews > 0 || driver.reliabilityScore?.totalRatings > 0) && (
                <>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(driver.reviewStats?.avgStars || driver.reliabilityScore?.avgRating || driver.rating)?.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">&middot;</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">{driver.trips ?? 0} trips</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ride.genderPreference && ride.genderPreference !== "any" && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${
              ride.genderPreference === "women-only" 
                ? "bg-pink-500/10 text-pink-500"
                : "bg-blue-500/10 text-blue-500"
            }`}>
              <UserCircle className="h-3 w-3" />
              {ride.genderPreference === "women-only" ? "Women Only" : "Men Only"}
            </span>
          )}
          {ride.requiresCoDriver && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-yellow-500/10 text-yellow-500 text-xs font-medium">
              <ShieldCheck className="h-3 w-3" />
              Co-Driver
            </span>
          )}
          {ride.instantBooking && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-system-green/10 text-system-green text-xs font-medium">
              <Zap className="h-3 w-3" />
              Instant
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs font-medium ${seatsColor}`}>
            <Users className="h-3 w-3" />
            {seatsLeft} left
          </span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-sm">
            {ride.vehicleType || "Car"}
          </span>
        </div>
      </div>
    </Link>
  );
}
