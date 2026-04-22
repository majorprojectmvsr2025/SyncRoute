import { Link } from "react-router-dom";
import { Star, Zap, Shield, Users, Calendar, UserCircle, ShieldCheck, Sparkles, Info, Route } from "lucide-react";
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

function getMatchQualityStyle(quality?: string, percentage?: number) {
  if (!quality && !percentage) return null;
  
  const pct = percentage || 0;
  
  if (quality === 'excellent' || pct >= 80) {
    return { bg: 'bg-neutral-900 dark:bg-white', text: 'text-white dark:text-neutral-900', label: 'Excellent match' };
  } else if (quality === 'good' || pct >= 70) {
    return { bg: 'bg-neutral-700 dark:bg-neutral-200', text: 'text-white dark:text-neutral-900', label: 'Good match' };
  } else if (pct >= 60) {
    return { bg: 'bg-neutral-500 dark:bg-neutral-400', text: 'text-white dark:text-neutral-900', label: 'Fair match' };
  }
  return null;
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
  const seatsColor = seatsPercent > 50 ? "text-neutral-600 dark:text-neutral-400" : seatsPercent > 20 ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-900 dark:text-white";

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

  const matchQuality = getMatchQualityStyle(ride.matchQuality, ride.overlapPercentage);
  const overlapPct = ride.overlapPercentage;
  const walkingInfo = (ride.walkingToPickupMinutes || ride.walkingFromDropMinutes) 
    ? `${ride.walkingToPickupMinutes || 0}min walk to pickup` 
    : null;

  const rideUrl = searchCoords
    ? `/rides/${ride._id}?pLat=${searchCoords.fromLat}&pLng=${searchCoords.fromLng}&dLat=${searchCoords.toLat}&dLng=${searchCoords.toLng}`
    : `/rides/${ride._id}`;

  return (
    <Link
      to={rideUrl}
      className={`block px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors relative ${
        personalization.isRecommended ? "bg-neutral-50 dark:bg-neutral-800/50 border-l-2 border-l-neutral-900 dark:border-l-white" : ""
      }`}
    >
      {/* Recommendation Reasons Tooltip */}
      {showReasons && personalization.reasons && personalization.reasons.length > 0 && (
        <div className="absolute top-10 right-2 z-10 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg p-3 max-w-xs rounded-lg">
          <p className="text-xs font-medium text-neutral-900 dark:text-white mb-1.5">Why we recommend this:</p>
          <ul className="space-y-1">
            {personalization.reasons.slice(0, 3).map((reason, i) => (
              <li key={i} className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                <span className="text-neutral-400 dark:text-neutral-500 mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
          {personalization.score && (
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700">
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
            <span className="text-base font-semibold tabular-nums shrink-0 w-14 text-right text-neutral-900 dark:text-white">
              {ride.departureTime || "\u2014"}
            </span>
            <div className="flex items-center gap-2 min-w-0 pt-[3px]">
              <div className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-white shrink-0" />
              <span className="text-sm font-medium truncate text-neutral-900 dark:text-white">{ride.from?.name || "Origin"}</span>
            </div>
          </div>

          {/* Connector with duration */}
          <div className="flex gap-3 my-0.5">
            <div className="w-14 shrink-0 flex justify-end">
              {duration && (
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">{duration}</span>
              )}
            </div>
            <div className="ml-[3px] w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
          </div>

          {/* Arrival row */}
          <div className="flex items-start gap-3">
            <span className="text-sm tabular-nums shrink-0 w-14 text-right text-neutral-500 dark:text-neutral-400">
              {arrivalTime || "\u2014"}
            </span>
            <div className="flex items-center gap-2 min-w-0 pt-[2px]">
              <div className="h-2 w-2 border-2 border-neutral-500 dark:border-neutral-400 shrink-0" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{ride.to?.name || "Destination"}</span>
            </div>
          </div>

          {/* Date + stops + walking info + badges row */}
          <div className="flex items-center gap-2 mt-3 ml-[68px] flex-wrap">
            {ride.date && (
              <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                <Calendar className="h-3 w-3" />
                {ride.date}
              </span>
            )}
            {ride.stops?.length > 0 && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {ride.stops.length} stop{ride.stops.length > 1 ? "s" : ""}
              </span>
            )}
            {walkingInfo && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                🚶 {walkingInfo}
              </span>
            )}
            {/* Match badge — inline with date/stops, NOT overlapping price */}
            {matchQuality && overlapPct && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${matchQuality.bg} ${matchQuality.text} text-[10px] font-semibold`}>
                <Route className="h-2.5 w-2.5" />
                {overlapPct}% match
              </span>
            )}
            {personalization.isRecommended && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-semibold">
                <Sparkles className="h-2.5 w-2.5" />
                For you
              </span>
            )}
            {personalization.isRecommended && personalization.reasons && personalization.reasons.length > 0 && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReasons(!showReasons); }}
                className="p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                title="Why recommended?"
              >
                <Info className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
              </button>
            )}
          </div>
        </div>

        {/* Price column — clean, no overlap */}
        <div className="text-right shrink-0 min-w-[56px]">
          <div className="text-xl font-bold leading-none text-neutral-900 dark:text-white">{"\u20B9"}{effectivePrice}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">per seat</div>
        </div>
      </div>

      {/* Driver row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-700">
        <div className="flex items-center gap-2.5">
          <UserAvatar photo={driver.photo} name={driver.name} size="sm" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium leading-none text-neutral-900 dark:text-white">{driver.name || "Driver"}</span>
              {driver.verified && (
                <Shield className="h-3 w-3 text-neutral-600 dark:text-neutral-400" />
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {(driver.reviewStats?.totalReviews > 0 || driver.reliabilityScore?.totalRatings > 0) && (
                <>
                  <Star className="h-3 w-3 fill-neutral-400 text-neutral-400 dark:fill-neutral-500 dark:text-neutral-500" />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {(driver.reviewStats?.avgStars || driver.reliabilityScore?.avgRating)?.toFixed(1)}
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">&middot;</span>
                </>
              )}
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{driver.trips ?? 0} trips</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ride.genderPreference && ride.genderPreference !== "any" && (
            <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${
              ride.genderPreference === "women-only" 
                ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}>
              <UserCircle className="h-3 w-3" />
              {ride.genderPreference === "women-only" ? "Women Only" : "Men Only"}
            </span>
          )}
          {ride.requiresCoDriver && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium">
              <ShieldCheck className="h-3 w-3" />
              Co-Driver
            </span>
          )}
          {ride.instantBooking && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium">
              <Zap className="h-3 w-3" />
              Instant
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs font-medium ${seatsColor}`}>
            <Users className="h-3 w-3" />
            {seatsLeft} left
          </span>
          <span className="text-xs text-neutral-600 dark:text-neutral-300 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700">
            {ride.vehicleType || "Car"}
          </span>
        </div>
      </div>
    </Link>
  );
}
