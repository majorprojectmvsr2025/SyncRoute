import { Link } from "react-router-dom";
import { Star, Zap, Shield, Users, Calendar } from "lucide-react";

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
      className="block px-5 py-4 hover:bg-accent/40 transition-colors"
    >
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
          {driver.photo ? (
            <img
              src={driver.photo}
              alt={driver.name}
              className="h-7 w-7 rounded-full object-cover bg-muted"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold">
              {initials}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium leading-none">{driver.name || "Driver"}</span>
              {driver.verified && (
                <Shield className="h-3 w-3 text-primary" />
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs text-muted-foreground tabular-nums">
                {driver.rating?.toFixed(1) ?? "5.0"}
              </span>
              <span className="text-xs text-muted-foreground">&middot; {driver.trips ?? 0} trips</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
