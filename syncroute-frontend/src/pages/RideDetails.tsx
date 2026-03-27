import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ridesAPI, bookingsAPI, reviewsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Star,
  Shield,
  Zap,
  Users,
  ArrowLeft,
  MessageSquare,
  Loader2,
  PenLine,
  X,
  Music,
  Wind,
  MessageCircle,
  Shuffle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { RideMap } from "@/components/map/RideMap";
import { RideStatusTimeline } from "@/components/rides/RideStatusTimeline";
import { StarRating } from "@/components/reviews/StarRating";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDistanceToNow } from "date-fns";

export default function RideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // User's search pickup/drop coords (passed from SearchResults)
  const pLat = parseFloat(searchParams.get("pLat") || "0");
  const pLng = parseFloat(searchParams.get("pLng") || "0");
  const dLat = parseFloat(searchParams.get("dLat") || "0");
  const dLng = parseFloat(searchParams.get("dLng") || "0");
  const userPickup: [number, number] | undefined = pLat && pLng ? [pLat, pLng] : undefined;
  const userDrop: [number, number] | undefined = dLat && dLng ? [dLat, dLng] : undefined;

  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [seats, setSeats] = useState(1);

  // User's existing booking for this ride
  const [userBooking, setUserBooking] = useState<any>(null);

  // Driver reviews
  const [driverReviews, setDriverReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Leave-a-review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // User's GPS location for map
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Actual OSRM road route between user's pickup and drop
  const [userRoute, setUserRoute] = useState<[number, number][] | undefined>(undefined);
  const [userSegmentDistanceM, setUserSegmentDistanceM] = useState<number | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {} // silently ignore if denied
      );
    }
  }, []);

  // Fetch actual road route (OSRM) between user's search pickup and drop
  useEffect(() => {
    if (!pLat || !pLng || !dLat || !dLng) return;
    fetch(
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pLng},${pLat};${dLng},${dLat}` +
      `?overview=full&geometries=geojson`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.routes?.[0]) {
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          );
          setUserRoute(coords);
          setUserSegmentDistanceM(data.routes[0].distance);
        }
      })
      .catch(() => {});
  }, [pLat, pLng, dLat, dLng]);

  useEffect(() => {
    loadRide();
  }, [id]);

  // After ride loads, fetch additional data that requires the ride object
  useEffect(() => {
    if (!ride) return;

    if (user) {
      loadUserBooking();
    }

    if (ride.driver?._id) {
      loadDriverReviews(ride.driver._id);
    }
  }, [ride, user]);

  // Once userBooking and driverReviews are loaded, check if user already reviewed
  useEffect(() => {
    if (!userBooking || driverReviews.length === 0) return;
    const bookingId = userBooking._id;
    const alreadyReviewed = driverReviews.some(
      (r: any) => r.booking === bookingId || r.booking?._id === bookingId
    );
    setHasReviewed(alreadyReviewed);
  }, [userBooking, driverReviews]);

  const loadRide = async () => {
    try {
      const data = await ridesAPI.getById(id!);
      setRide(data);
    } catch (error) {
      console.error("Load ride error:", error);
      toast.error("Failed to load ride");
    } finally {
      setLoading(false);
    }
  };

  const loadUserBooking = async () => {
    try {
      const bookings = await bookingsAPI.getMyBookings();
      const match = bookings.find(
        (b: any) => b.ride?._id === id || b.ride === id
      );
      if (match) setUserBooking(match);
    } catch (error) {
      // silently fail — user may not be logged in or have no bookings
    }
  };

  const loadDriverReviews = async (driverId: string) => {
    setReviewsLoading(true);
    try {
      const data = await reviewsAPI.getByUser(driverId);
      setDriverReviews(Array.isArray(data) ? data : (data.reviews || []));
    } catch (error) {
      // silently fail
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleBook = async () => {
    if (!user) {
      toast.error("Please sign in to book a ride");
      navigate("/sign-in", { state: { from: { pathname: `/rides/${id}` } } });
      return;
    }

    // Prevent driver from booking their own ride
    if (ride.driver?._id === user._id) {
      toast.error("You cannot book your own ride");
      return;
    }

    if (seats > ride.availableSeats) {
      toast.error(`Only ${ride.availableSeats} seats available`);
      return;
    }

    setBooking(true);
    try {
      await bookingsAPI.create({
        rideId: ride._id,
        seats,
      });

      toast.success("Ride booked successfully!");
      navigate("/profile");
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.response?.data?.message || "Failed to book ride");
    } finally {
      setBooking(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!userBooking) return;
    setSubmittingReview(true);
    try {
      await reviewsAPI.create({
        bookingId: userBooking._id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      toast.success("Review submitted. Thank you!");
      setShowReviewForm(false);
      setReviewComment("");
      setReviewRating(5);
      setHasReviewed(true);
      // Refetch driver reviews to show the new one
      if (ride.driver?._id) {
        await loadDriverReviews(ride.driver._id);
      }
    } catch (error: any) {
      console.error("Review error:", error);
      toast.error(error.response?.data?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">Ride not found</p>
            <Link to="/search" className="text-sm text-primary hover:underline">
              Back to search
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const effectivePrice =
    userSegmentDistanceM != null && ride.estimatedDistance > 0
      ? Math.max(1, Math.round(ride.price * userSegmentDistanceM / ride.estimatedDistance))
      : ride.price;
  const totalPrice = effectivePrice * seats;
  const serviceFee = Math.round(totalPrice * 0.05); // 5% service fee
  const finalPrice = totalPrice + serviceFee;

  const driverAvgRating =
    driverReviews.length > 0
      ? driverReviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
        driverReviews.length
      : 0;

  const routeEstimate =
    ride.estimatedDuration
      ? estimateArrivalFromDuration(ride.departureTime, ride.estimatedDuration)
      : ride.routePath?.coordinates?.length > 1
        ? estimateArrival(ride.departureTime, ride.routePath.coordinates)
        : null;

  const canLeaveReview =
    user &&
    userBooking?.status === "completed" &&
    !hasReviewed &&
    ride.driver?._id !== user._id;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        <Link
          to="/search"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-system mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to results
        </Link>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-4">
            {/* Route */}
            <div className="border border-border bg-card p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Route
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold font-mono">
                    {ride.departureTime}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[100px] truncate">
                    {ride.from?.name || "Start"}
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-px bg-border relative">
                    {ride.stops &&
                      ride.stops.length > 0 &&
                      ride.stops.map((_: any, i: number) => (
                        <div
                          key={i}
                          className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-border"
                          style={{
                            left: `${((i + 1) / (ride.stops.length + 1)) * 100}%`,
                          }}
                        />
                      ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {routeEstimate?.duration || (ride.stops && ride.stops.length > 0
                      ? ride.stops.join(" · ")
                      : "Direct")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold font-mono">
                    {ride.arrivalTime || routeEstimate?.arrivalTime || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[100px] truncate">
                    {ride.to?.name || "End"}
                  </div>
                  {!ride.arrivalTime && routeEstimate && (
                    <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      <span>est.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Map — shown when route path coordinates are available */}
            {ride.routePath?.coordinates && ride.routePath.coordinates.length > 1 && (
              <RideMap
                routeCoords={ride.routePath.coordinates}
                fromName={ride.from?.name || ""}
                toName={ride.to?.name || ""}
                height="380px"
                userLocation={userLocation ?? undefined}
                userPickup={userPickup}
                userDrop={userDrop}
                userRoute={userRoute}
              />
            )}

            {/* Map legend when user search coords are present */}
            {(userPickup || userDrop) && (
              <div className="flex items-center gap-4 px-3 py-2 border border-border rounded-lg text-[11px] text-muted-foreground bg-card">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb] inline-block" />
                  Driver's route
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-0 w-8 border-t-2 border-[#16a34a]"
                    style={{ borderStyle: "dashed" }}
                  />
                  Your route
                </span>
              </div>
            )}

            {/* Trip Details */}
            <div className="border border-border bg-card divide-y divide-border rounded-lg">
              <div className="p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                  Trip Details
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Detail label="Vehicle" value={ride.vehicleModel || ride.vehicleType} />
                  <Detail label="Type" value={ride.vehicleType} />
                  <Detail
                    label="Date"
                    value={new Date(ride.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  />
                  <Detail
                    label="Seats"
                    value={`${ride.availableSeats}/${ride.totalSeats} available`}
                  />
                </div>
              </div>
              <div className="p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                  Preferences
                </div>
                <div className="flex flex-wrap gap-2">
                  {ride.driver?.verified && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-sm">
                      <Shield className="h-3 w-3 text-primary" /> ID Verified
                    </span>
                  )}
                  {ride.instantBooking && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-sm text-system-green">
                      <Zap className="h-3 w-3" /> Instant Booking
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-sm">
                    {ride.genderPreference === "any"
                      ? "Any Gender"
                      : ride.genderPreference === "women-only"
                      ? "Women Only"
                      : "Men Only"}
                  </span>
                  {ride.sharedDriving && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-sm text-muted-foreground">
                      <Shuffle className="h-3 w-3" /> Co-driving OK
                    </span>
                  )}
                  {ride.smokingAllowed && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-sm text-muted-foreground">
                      <Wind className="h-3 w-3" /> Smoking OK
                    </span>
                  )}
                  {ride.musicPreference && ride.musicPreference !== "any" && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-sm text-muted-foreground">
                      <Music className="h-3 w-3" />
                      {ride.musicPreference === "none" ? "No music" : "Soft music"}
                    </span>
                  )}
                  {ride.conversationStyle && ride.conversationStyle !== "flexible" && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-sm text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      {ride.conversationStyle === "chatty" ? "Chatty ride" : "Quiet ride"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Driver */}
            <div className="border border-border bg-card p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Driver
              </div>
              <div className="flex items-center gap-3 mb-3">
                {ride.driver?.photo ? (
                  <img
                    src={ride.driver.photo}
                    alt={ride.driver.name || "Driver"}
                    className="h-12 w-12 rounded-sm object-cover shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-sm bg-muted flex items-center justify-center text-sm font-mono font-medium shrink-0">
                    {ride.driver?.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase() || "??"}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">
                      {ride.driver?.name || "Unknown"}
                    </span>
                    {ride.driver?.verified && (
                      <Shield className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" />
                    <span className="font-mono">
                      {ride.driver?.rating?.toFixed(1) || "5.0"}
                    </span>
                    <span>·</span>
                    <span>{ride.driver?.trips || 0} trips</span>
                  </div>
                </div>
              </div>
              <Link
                to={`/chat?rideId=${ride._id}&userId=${ride.driver?._id}&userName=${encodeURIComponent(ride.driver?.name || "Driver")}&route=${encodeURIComponent(`${ride.from?.name || ""} → ${ride.to?.name || ""}`)}`}
                className="w-full h-9 flex items-center justify-center gap-2 text-sm border border-border rounded-sm transition-system control-hover"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Message Driver
              </Link>
            </div>

            {/* Driver Reviews */}
            <div className="border border-border bg-card p-4 space-y-3 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Driver Reviews
              </div>

              {reviewsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : driverReviews.length === 0 ? (
                <EmptyState
                  icon={<Star className="h-5 w-5" />}
                  title="No reviews yet"
                  description="This driver hasn't received any reviews yet."
                />
              ) : (
                <>
                  {/* Average */}
                  <div className="flex items-center gap-2">
                    <StarRating value={driverAvgRating} size="sm" showValue />
                    <span className="text-xs text-muted-foreground">
                      ({driverReviews.length} review
                      {driverReviews.length !== 1 ? "s" : ""})
                    </span>
                  </div>

                  {/* Last 3 reviews */}
                  <div className="space-y-3">
                    {driverReviews.slice(0, 3).map((review: any) => {
                      const reviewerName = review.reviewer?.name || "Anonymous";
                      const initials = reviewerName
                        .split(" ")
                        .slice(0, 2)
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase();
                      return (
                        <div
                          key={review._id}
                          className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                        >
                          <div className="flex items-start gap-2">
                            <div className="h-6 w-6 rounded-sm bg-muted flex items-center justify-center text-[10px] font-mono font-semibold shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="text-xs font-medium truncate">
                                  {reviewerName}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {review.createdAt
                                    ? formatDistanceToNow(
                                        new Date(review.createdAt),
                                        { addSuffix: true }
                                      )
                                    : ""}
                                </span>
                              </div>
                              <StarRating value={review.rating} size="sm" />
                              {review.comment && (
                                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                                  {review.comment}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Leave a Review button / inline form */}
              {canLeaveReview && !showReviewForm && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="w-full h-9 flex items-center justify-center gap-2 text-sm border border-dashed border-border rounded-sm hover:bg-accent transition-colors mt-2"
                >
                  <PenLine className="h-3.5 w-3.5" /> Leave a Review
                </button>
              )}

              {canLeaveReview && showReviewForm && (
                <div className="border border-border rounded-sm p-3 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Your Review</span>
                    <button
                      onClick={() => {
                        setShowReviewForm(false);
                        setReviewComment("");
                        setReviewRating(5);
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
                      Rating
                    </label>
                    <StarRating
                      value={reviewRating}
                      onChange={setReviewRating}
                      size="md"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
                      Comment (optional)
                    </label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={3}
                      placeholder="Share your experience..."
                      className="w-full px-2.5 py-2 bg-background border border-border rounded-sm text-xs focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmitReview}
                    disabled={submittingReview}
                    className="w-full h-8 bg-primary text-primary-foreground text-xs font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    {submittingReview ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Submitting...
                      </>
                    ) : (
                      "Submit Review"
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Booking status timeline */}
            {userBooking && (
              <div className="border border-border rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-4">
                  Booking Status
                </p>
                <RideStatusTimeline status={userBooking.status} />
              </div>
            )}

            {/* Booking */}
            <div className="border border-border bg-card p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Book This Ride
              </div>

              {/* Seat Selection */}
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-2 block">
                  Number of Seats
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSeats(Math.max(1, seats - 1))}
                    className="h-9 w-9 border border-border rounded-sm hover:bg-accent transition-colors"
                    disabled={seats <= 1}
                  >
                    -
                  </button>
                  <div className="flex-1 h-9 border border-border rounded-sm flex items-center justify-center font-medium">
                    {seats}
                  </div>
                  <button
                    onClick={() => setSeats(Math.min(ride.availableSeats, seats + 1))}
                    className="h-9 w-9 border border-border rounded-sm hover:bg-accent transition-colors"
                    disabled={seats >= ride.availableSeats}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    ₹{effectivePrice} × {seats} seat{seats > 1 ? "s" : ""}
                    {userSegmentDistanceM != null && ride.estimatedDistance > 0 && (
                      <span className="ml-1 text-[10px] text-muted-foreground/70">(your segment)</span>
                    )}
                  </span>
                  <span className="font-mono">₹{totalPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="font-mono">₹{serviceFee}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="font-mono">₹{finalPrice}</span>
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{ride.availableSeats} seats available</span>
                {ride.instantBooking && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-system-green">
                      <Zap className="h-3 w-3" /> Instant
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={handleBook}
                disabled={
                  booking ||
                  ride.availableSeats === 0 ||
                  (user && ride.driver?._id === user._id) ||
                  !!userBooking
                }
                className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-sm transition-system hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : userBooking ? (
                  "Already Booked"
                ) : user && ride.driver?._id === user._id ? (
                  "Your Ride"
                ) : (
                  <>Book Ride — ₹{finalPrice}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

// Use OSRM-provided duration (seconds) — most accurate, accounts for road type/speed limits
function estimateArrivalFromDuration(
  departureTime: string,
  durationSeconds: number
): { arrivalTime: string; duration: string } | null {
  if (!departureTime || !durationSeconds) return null;
  try {
    // Indian roads: OSRM assumes optimal no-traffic conditions. Real-world
    // driving with signals, congestion, and urban stops adds ~60% on average.
    const adjustedSeconds = durationSeconds * 1.6;
    const totalMinutes = Math.round(adjustedSeconds / 60);

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const duration =
      h > 0
        ? m > 0
          ? `~${h}h ${m}m`
          : `~${h}h`
        : `~${m}m`;

    const [dh, dm] = departureTime.split(":").map(Number);
    const total = (dh * 60 + dm + totalMinutes) % (24 * 60);
    const ah = Math.floor(total / 60);
    const am = total % 60;
    const arrivalTime = `${String(ah).padStart(2, "0")}:${String(am).padStart(2, "0")}`;
    return { arrivalTime, duration };
  } catch {
    return null;
  }
}

// Fallback: Estimate arrival time using Haversine summed across all route segments
function estimateArrival(
  departureTime: string,
  coords: [number, number][]
): { arrivalTime: string; duration: string } | null {
  if (!coords || coords.length < 2 || !departureTime) return null;
  try {
    let totalDist = 0;
    const R = 6371;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    // Use 28 km/h avg for Indian urban driving (traffic, signals, congestion)
    const totalMinutes = Math.round((totalDist / 28) * 60);

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const duration =
      h > 0
        ? m > 0
          ? `~${h}h ${m}m`
          : `~${h}h`
        : `~${m}m`;

    const [dh, dm] = departureTime.split(":").map(Number);
    const total = (dh * 60 + dm + totalMinutes) % (24 * 60);
    const ah = Math.floor(total / 60);
    const am = total % 60;
    const arrivalTime = `${String(ah).padStart(2, "0")}:${String(am).padStart(2, "0")}`;
    return { arrivalTime, duration };
  } catch {
    return null;
  }
}
