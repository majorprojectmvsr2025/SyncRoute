import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ridesAPI, bookingsAPI, reviewsAPI, authAPI, ridesExtendedAPI, waitlistAPI, prieAPI } from "@/lib/api";
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
  ShieldCheck,
  AlertTriangle,
  UserIcon,
  Upload,
  FileText,
  Car,
  CheckCircle2,
  Play,
  Sparkles,
  Info,
  MapPin,
  Navigation,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { RideMap } from "@/components/map/RideMap";
import { RideStatusTimeline } from "@/components/rides/RideStatusTimeline";
import { StarRating } from "@/components/reviews/StarRating";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { SOSButton } from "@/components/rides/SOSButton";
import { LiveLocationSharing } from "@/components/rides/LiveLocationSharing";
import { WaitlistButton } from "@/components/rides/WaitlistButton";
import { DriverReliabilityScore } from "@/components/ui/DriverReliabilityScore";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";

export default function RideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
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
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [enableWhatsAppNotifications, setEnableWhatsAppNotifications] = useState(true);

  // User's existing booking for this ride
  const [userBooking, setUserBooking] = useState<any>(null);

  // Driver: all bookings for this ride
  const [rideBookings, setRideBookings] = useState<any[]>([]);
  const [rideBookingsLoading, setRideBookingsLoading] = useState(false);

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

  // Personalization data
  const [personalization, setPersonalization] = useState<{
    isRecommended?: boolean;
    reasons?: string[];
    score?: number;
  } | null>(null);
  const [showPersonalizationReasons, setShowPersonalizationReasons] = useState(false);

  // Validation modals
  const [showGenderMismatchModal, setShowGenderMismatchModal] = useState(false);
  const [showCoDriverModal, setShowCoDriverModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Verification form fields for co-driver
  const [drivingLicenseId, setDrivingLicenseId] = useState("");
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleRegFile, setVehicleRegFile] = useState<File | null>(null);
  const [verificationVehicleType, setVerificationVehicleType] = useState("Sedan");
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");

  // Safety features state
  const [confirmingRideStart, setConfirmingRideStart] = useState(false);
  const [routeDeviationAlert, setRouteDeviationAlert] = useState<string | null>(null);

  // Delete/Cancel ride state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Ride completion state
  const [completingRide, setCompletingRide] = useState(false);
  const [confirmingReceived, setConfirmingReceived] = useState(false);

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
      // If current user is the driver, load all bookings for this ride
      if (ride.driver?._id === user._id) {
        loadRideBookings();
      }
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
      
      // If ride has personalization data from search (passed in URL), use it
      // Otherwise, if user is logged in, try to get personalization for this ride
      if (data.personalization) {
        setPersonalization(data.personalization);
      } else if (user && pLat && pLng && dLat && dLng) {
        // Try to get personalized score for this ride
        try {
          const result = await prieAPI.search({
            pickupLat: pLat,
            pickupLng: pLng,
            dropLat: dLat,
            dropLng: dLng,
            date: data.date,
          });
          const matchedRide = result.rides?.find((r: any) => r._id === id);
          if (matchedRide?.personalization) {
            setPersonalization(matchedRide.personalization);
          }
        } catch {
          // Silently fail - personalization is optional
        }
      }
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

  const loadRideBookings = async () => {
    setRideBookingsLoading(true);
    try {
      // Get all bookings for this specific ride (driver view)
      const allBookings = await bookingsAPI.getRideBookings();
      const thisRideBookings = allBookings.filter(
        (b: any) => b.ride?._id === id || b.ride === id
      );
      setRideBookings(thisRideBookings);
    } catch {
      // silently fail
    } finally {
      setRideBookingsLoading(false);
    }
  };

  const handleBookingAction = async (bookingId: string, action: "confirm" | "reject") => {
    try {
      if (action === "confirm") {
        await bookingsAPI.confirm(bookingId);
        toast.success("Booking confirmed!");
      } else {
        await bookingsAPI.reject(bookingId);
        toast.success("Booking rejected.");
      }
      loadRideBookings();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Action failed");
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

    // Check gender preference
    if (ride.genderPreference && ride.genderPreference !== "any") {
      const userGender = (user as any)?.gender;
      
      if (!userGender || userGender === "prefer_not_to_say") {
        setShowGenderMismatchModal(true);
        return;
      }
      
      if (ride.genderPreference === "women-only" && userGender !== "female") {
        toast.error("This ride is restricted to female passengers only");
        return;
      }
      
      if (ride.genderPreference === "men-only" && userGender !== "male") {
        toast.error("This ride is restricted to male passengers only");
        return;
      }
    }

    // Check co-driver requirement
    if (ride.requiresCoDriver || ride.sharedDriving) {
      const isDriverVerified = (user as any)?.driverVerified || (user as any)?.driverVerification?.isVerified === true;
      
      if (!isDriverVerified) {
        setShowCoDriverModal(true);
        return;
      }
    }

    setBooking(true);
    try {
      const response = await bookingsAPI.create({
        rideId: ride._id,
        seats,
        enableWhatsAppNotifications,
      });

      // Show loading animation
      setShowBookingSuccess(true);
      
      // Wait for animation to complete
      setTimeout(() => {
        // Check booking status to show appropriate message
        if (response.status === "pending") {
          toast.success("Ride request sent! Waiting for driver approval.");
        } else {
          toast.success("Ride booked successfully!");
        }
        navigate("/profile");
      }, 3000);
    } catch (error: any) {
      console.error("Booking error:", error);
      const errorCode = error.response?.data?.code;
      
      if (errorCode === "GENDER_NOT_SPECIFIED") {
        setShowGenderMismatchModal(true);
      } else if (errorCode === "DRIVER_VERIFICATION_REQUIRED") {
        setShowCoDriverModal(true);
      } else {
        toast.error(error.response?.data?.message || "Failed to book ride");
      }
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

  // Helper functions for verification
  const validateLicenseFormat = (license: string): boolean => {
    const dlPattern = /^[A-Z]{2}[- ]?\d{2}[- ]?\d{4}[- ]?\d{6,7}$/i;
    return dlPattern.test(license.replace(/\s/g, ""));
  };

  const validateVehicleNumber = (number: string): boolean => {
    const rcPattern = /^[A-Z]{2}[- ]?\d{1,2}[- ]?[A-Z]{1,3}[- ]?\d{1,4}$/i;
    return rcPattern.test(number.replace(/\s/g, ""));
  };

  const isLegalDrivingAge = (dob: string): boolean => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleVerificationSubmit = async () => {
    if (!drivingLicenseId || !validateLicenseFormat(drivingLicenseId)) {
      toast.error("Please enter a valid driving license number");
      return;
    }

    if (!dateOfBirth || !isLegalDrivingAge(dateOfBirth)) {
      toast.error("You must be at least 18 years old");
      return;
    }

    if (!vehicleNumber || !validateVehicleNumber(vehicleNumber)) {
      toast.error("Please enter a valid vehicle registration number");
      return;
    }

    setVerifying(true);
    try {
      let licenseImage = "";
      if (drivingLicenseFile) {
        licenseImage = await fileToBase64(drivingLicenseFile);
      }

      let vehicleRegDoc = "";
      if (vehicleRegFile) {
        vehicleRegDoc = await fileToBase64(vehicleRegFile);
      }

      let vehiclePhoto = "";
      if (vehiclePhotoFile) {
        vehiclePhoto = await fileToBase64(vehiclePhotoFile);
      }

      const result = await authAPI.updateProfile({
        dateOfBirth,
        driverVerification: {
          drivingLicenseId: drivingLicenseId.toUpperCase().replace(/\s/g, ""),
          drivingLicenseImage: licenseImage,
          drivingLicenseVerified: true,
          vehicleNumber: vehicleNumber.toUpperCase().replace(/\s/g, ""),
          vehicleRegistrationDoc: vehicleRegDoc,
          vehicleRegistrationVerified: true,
          vehicleType: verificationVehicleType,
          vehiclePhoto: vehiclePhoto,
          isVerified: true,
        },
      });

      updateUser(result);
      toast.success("Driver verification completed!");
      setShowVerificationModal(false);
      setShowCoDriverModal(false);
      
      // Now proceed with booking
      handleBook();
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.response?.data?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // Handle ride start confirmation
  const handleConfirmRideStart = async () => {
    if (!id || !user) return;
    setConfirmingRideStart(true);
    try {
      const isDriver = ride.driver?._id === user._id;
      if (isDriver) {
        await ridesExtendedAPI.confirmStartDriver(id);
      } else {
        if (!userBooking?._id) {
          toast.error("No booking found");
          return;
        }
        await ridesExtendedAPI.confirmStartPassenger(id, userBooking._id);
      }
      toast.success("Ride start confirmed!");
      await loadRide();
    } catch (error: any) {
      console.error("Confirm ride start error:", error);
      toast.error(error.response?.data?.message || "Failed to confirm ride start");
    } finally {
      setConfirmingRideStart(false);
    }
  };

  // Handle route deviation callback from LiveLocationSharing
  const handleRouteDeviation = (deviation: { distance: number; message: string }) => {
    setRouteDeviationAlert(deviation.message || `Possible route deviation detected: ${deviation.distance.toFixed(1)}km from planned route`);
    setTimeout(() => setRouteDeviationAlert(null), 10000);
  };

  // Delete ride (for ride creator only)
  const handleDeleteRide = async () => {
    if (!ride?._id) return;
    setDeleting(true);
    try {
      await ridesAPI.delete(ride._id);
      toast.success("Ride deleted successfully");
      navigate("/profile");
    } catch (error: any) {
      console.error("Delete ride error:", error);
      toast.error(error.response?.data?.message || "Failed to delete ride");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Cancel booking (for passenger only)
  const handleCancelBooking = async () => {
    if (!userBooking?._id) return;
    setCancelling(true);
    try {
      await bookingsAPI.cancel(userBooking._id);
      toast.success("Booking cancelled successfully");
      setUserBooking(null);
      await loadRide(); // Refresh to update available seats
    } catch (error: any) {
      console.error("Cancel booking error:", error);
      toast.error(error.response?.data?.message || "Failed to cancel booking");
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

  // Driver completes the ride
  const handleCompleteRide = async () => {
    if (!ride?._id) return;
    setCompletingRide(true);
    try {
      await ridesExtendedAPI.completeRide(ride._id);
      toast.success("Ride marked as completed!");
      await loadRide();
      // Refresh user data to update trip count for driver
      if (updateUser) {
        const freshUser = await authAPI.getCurrentUser();
        updateUser(freshUser);
      }
    } catch (error: any) {
      console.error("Complete ride error:", error);
      toast.error(error.response?.data?.message || "Failed to complete ride");
    } finally {
      setCompletingRide(false);
    }
  };

  // Passenger confirms ride received
  const handleConfirmReceived = async () => {
    if (!userBooking?._id || !ride?._id) return;
    setConfirmingReceived(true);
    try {
      // Use ridesAPI.confirmRideReceived which calls POST /rides/:id/confirm-received
      await ridesAPI.confirmRideReceived(ride._id, userBooking._id);
      toast.success("Ride confirmed as received!");
      await loadRide();
      // Reload booking status
      const bookings = await bookingsAPI.getMyBookings();
      const thisBooking = bookings.find((b: any) => b.ride?._id === ride?._id);
      setUserBooking(thisBooking || null);
      // Refresh user data to update trip count
      if (updateUser) {
        const freshUser = await authAPI.getCurrentUser();
        updateUser(freshUser);
      }
    } catch (error: any) {
      console.error("Confirm received error:", error);
      toast.error(error.response?.data?.message || "Failed to confirm ride received");
    } finally {
      setConfirmingReceived(false);
    }
  };

  // Ride-time alert: show banner when ride is within 30 minutes
  const [rideTimeAlert, setRideTimeAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!ride || !user || ride.driver?._id !== user._id) return;
    if (ride.status !== "active") return;

    const checkRideTime = () => {
      if (!ride.date || !ride.departureTime) return;
      const rideDateTime = new Date(`${ride.date}T${ride.departureTime}`);
      const now = new Date();
      const diffMs = rideDateTime.getTime() - now.getTime();
      const diffMin = Math.round(diffMs / 60000);

      if (diffMin > 0 && diffMin <= 30) {
        setRideTimeAlert(`Your ride departs in ${diffMin} minute${diffMin !== 1 ? "s" : ""}! ${rideBookings.filter((b: any) => b.status !== "cancelled").length} passenger${rideBookings.filter((b: any) => b.status !== "cancelled").length !== 1 ? "s" : ""} booked.`);
      } else if (diffMin <= 0 && diffMin >= -15) {
        setRideTimeAlert("Your ride should be departing now. Confirm start when ready.");
      } else {
        setRideTimeAlert(null);
      }
    };

    checkRideTime();
    const iv = setInterval(checkRideTime, 30000);
    return () => clearInterval(iv);
  }, [ride, user, rideBookings]);

  // Check if ride is completed (past date)
  const isRideCompleted = () => {
    if (!ride) return false;
    const rideDateTime = new Date(`${ride.date}T${ride.departureTime || "00:00"}`);
    return rideDateTime < new Date();
  };

  // Check if ride has started (both driver and at least one passenger confirmed)
  const isRideStarted = () => {
    if (!ride?.rideConfirmation) return false;
    return ride.rideConfirmation.driverConfirmed && 
           (ride.rideConfirmation.passengerConfirmations?.length > 0);
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

  // Calculate proportional price based on user's segment
  const userSegmentKm = userSegmentDistanceM ? (userSegmentDistanceM / 1000) : null;
  const totalRideKm = ride.estimatedDistance ? (ride.estimatedDistance / 1000) : null;
  
  // Always calculate proportional price if we have segment data
  const effectivePrice = userSegmentKm && totalRideKm && totalRideKm > 0
    ? Math.max(1, Math.round(ride.price * (userSegmentKm / totalRideKm)))
    : ride.price;
  
  const totalPrice = effectivePrice * seats;
  const finalPrice = totalPrice; // No service fee — SyncRoute charges no commission
  
  // Show if this is proportional pricing
  const isProportionalPrice = userSegmentKm && totalRideKm && userSegmentKm < totalRideKm;

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
        {/* Ride-time alert banner for driver */}
        {rideTimeAlert && user && ride?.driver?._id === user._id && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-warning animate-in-up">
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse shrink-0" />
            <p className="text-sm font-semibold flex-1">{rideTimeAlert}</p>
            <button onClick={() => setRideTimeAlert(null)} className="text-warning/60 hover:text-warning transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <Link
            to="/search"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-system"
          >
            <ArrowLeft className="h-3 w-3" /> Back to results
          </Link>
          
          {/* Personalization Badge */}
          {personalization?.isRecommended && (
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  Recommended for you
                </span>
                {personalization.reasons && personalization.reasons.length > 0 && (
                  <button
                    onClick={() => setShowPersonalizationReasons(!showPersonalizationReasons)}
                    className="p-1.5 rounded-full hover:bg-accent transition-colors"
                    title="Why recommended?"
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              
              {/* Reasons Dropdown */}
              {showPersonalizationReasons && personalization.reasons && personalization.reasons.length > 0 && (
                <div className="absolute top-full right-0 mt-2 z-20 bg-popover border border-border rounded-lg shadow-lg p-4 max-w-sm">
                  <p className="text-sm font-medium text-foreground mb-2">Why we recommend this ride:</p>
                  <ul className="space-y-1.5">
                    {personalization.reasons.slice(0, 3).map((reason, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                  {personalization.score && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                      Match score: {Math.round(personalization.score * 100)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
                  {ride.requiresCoDriver && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs border border-yellow-500/50 bg-yellow-500/10 rounded-sm text-yellow-500">
                      <ShieldCheck className="h-3 w-3" /> Requires Co-Driver
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
                <UserAvatar 
                  photo={ride.driver?.photo} 
                  name={ride.driver?.name} 
                  size="lg" 
                  className="rounded-sm"
                />
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
                    {/* Only show rating if driver has actual reviews with ratings */}
                    {driverAvgRating > 0 && driverReviews.length > 0 && (
                      <>
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span className="font-mono">{driverAvgRating.toFixed(1)}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{ride.driver?.trips || 0} trips</span>
                  </div>
                </div>
              </div>

              {/* Driver Reliability Score */}
              {ride.driver?._id && (
                <div className="mb-3">
                  <DriverReliabilityScore driverId={ride.driver._id} compact />
                </div>
              )}

              <Link
                to={`/chat?rideId=${ride._id}&userId=${ride.driver?._id}&userName=${encodeURIComponent(ride.driver?.name || "Driver")}&route=${encodeURIComponent(`${ride.from?.name || ""} → ${ride.to?.name || ""}`)}`}
                className="w-full h-9 flex items-center justify-center gap-2 text-sm border border-border rounded-sm transition-system control-hover"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Message Driver
              </Link>
            </div>

            {/* ── DRIVER: Passengers who booked ── */}
            {user && ride.driver?._id === user._id && (
              <div className="border border-border bg-card p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Passengers
                  </div>
                  {rideBookings.length > 0 && (
                    <span className="text-xs font-semibold text-foreground bg-accent px-2 py-0.5 rounded-full">
                      {rideBookings.filter((b: any) => b.status !== "cancelled").length} booked
                    </span>
                  )}
                </div>

                {rideBookingsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : rideBookings.length === 0 ? (
                  <div className="text-center py-4">
                    <Users className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No bookings yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rideBookings.map((booking: any) => {
                      const passenger = booking.passenger || {};
                      const statusColors: Record<string, string> = {
                        confirmed: "text-success bg-success/10",
                        completed: "text-primary bg-primary/10",
                        pending: "text-warning bg-warning/10",
                        cancelled: "text-destructive bg-destructive/10",
                      };
                      const statusColor = statusColors[booking.status] || statusColors.pending;

                      // Compute passenger's actual segment times
                      // Use booking.pickupLocation / dropLocation if available for segment offset
                      // Otherwise fall back to full ride times
                      let pickupTime: string | null = null;
                      let dropTime: string | null = null;
                      let pickupName: string | null = null;
                      let dropName: string | null = null;

                      if (ride.departureTime) {
                        // Passenger pickup = ride departure (they board at start)
                        // If booking has a custom pickup point, estimate offset
                        const totalRideMinutes = ride.estimatedDuration
                          ? Math.round((ride.estimatedDuration * 1.6) / 60)
                          : null;

                        const [dh, dm] = ride.departureTime.split(":").map(Number);

                        // Pickup time: use booking.pickupTime if set, else ride departure
                        if (booking.pickupTime) {
                          pickupTime = booking.pickupTime;
                        } else {
                          pickupTime = ride.departureTime;
                        }

                        // Drop time: use booking.dropTime if set, else estimate from total duration
                        if (booking.dropTime) {
                          dropTime = booking.dropTime;
                        } else if (totalRideMinutes) {
                          // Estimate based on passenger's segment distance vs total
                          const segmentFraction = booking.segmentDistance && ride.estimatedDistance
                            ? Math.min(1, booking.segmentDistance / ride.estimatedDistance)
                            : 1;
                          const segmentMinutes = Math.round(totalRideMinutes * segmentFraction);
                          const [ph, pm2] = pickupTime.split(":").map(Number);
                          const dropTotal = (ph * 60 + pm2 + segmentMinutes) % (24 * 60);
                          const ah = Math.floor(dropTotal / 60);
                          const am = dropTotal % 60;
                          dropTime = `${String(ah).padStart(2, "0")}:${String(am).padStart(2, "0")}`;
                        }

                        // Location names
                        pickupName = booking.pickupLocation?.name || ride.from?.name || null;
                        dropName = booking.dropLocation?.name || ride.to?.name || null;
                      }

                      return (
                        <div key={booking._id} className="border border-border/50 rounded-xl p-3 space-y-2.5 transition-all duration-200 hover:border-border">
                          {/* Passenger info row */}
                          <div className="flex items-center gap-2.5">
                            {/* Use UserAvatar for proper Google photo support */}
                            <UserAvatar
                              photo={passenger.photo}
                              name={passenger.name}
                              size="sm"
                              className="rounded-xl shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground truncate">
                                  {passenger.name || "Passenger"}
                                </span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>
                                  {booking.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>{booking.seats} seat{booking.seats > 1 ? "s" : ""}</span>
                                <span>·</span>
                                <span className="font-semibold text-foreground">₹{booking.totalPrice}</span>
                                {passenger.phone && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono">{passenger.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Passenger's segment: from → to with times */}
                          {booking.status !== "cancelled" && (pickupTime || dropTime) && (
                            <div className="rounded-lg bg-muted/30 border border-border/30 overflow-hidden">
                              <div className="px-3 py-1.5 border-b border-border/20 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-muted-foreground/60" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Their segment</span>
                              </div>
                              <div className="px-3 py-2 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-success shrink-0" />
                                  <span className="font-semibold text-foreground tabular-nums text-xs">{pickupTime}</span>
                                  {pickupName && <span className="text-xs text-muted-foreground truncate">{pickupName}</span>}
                                </div>
                                <div className="ml-1 w-px h-3 bg-border/50" />
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                                  <span className="font-semibold text-foreground tabular-nums text-xs">{dropTime || "—"}</span>
                                  {dropName && <span className="text-xs text-muted-foreground truncate">{dropName}</span>}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            {booking.status !== "cancelled" && passenger._id && (
                              <Link
                                to={`/chat?rideId=${ride._id}&userId=${passenger._id}&userName=${encodeURIComponent(passenger.name || "Passenger")}&route=${encodeURIComponent(`${ride.from?.name || ""} → ${ride.to?.name || ""}`)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs font-medium border border-border/60 rounded-lg hover:bg-accent active:scale-95 transition-all duration-150"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Chat
                              </Link>
                            )}
                            {booking.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleBookingAction(booking._id, "confirm")}
                                  className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs font-semibold bg-success/10 text-success border border-success/20 rounded-lg hover:bg-success/20 active:scale-95 transition-all duration-150"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleBookingAction(booking._id, "reject")}
                                  className="h-8 w-8 flex items-center justify-center text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/10 active:scale-95 transition-all duration-150"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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

                {/* Estimated pickup/drop times for passenger */}
                {userBooking.status !== "cancelled" && ride.departureTime && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                      Your Journey Times
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-success shrink-0" />
                        <div className="flex-1">
                          <div className="text-[10px] text-muted-foreground">Estimated pickup</div>
                          <div className="text-sm font-semibold text-foreground tabular-nums">{ride.departureTime}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{ride.from?.name}</div>
                        </div>
                      </div>
                      {routeEstimate && (
                        <div className="ml-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <div className="w-px h-4 bg-border ml-0.5" />
                          <Clock className="h-3 w-3" />
                          <span>{routeEstimate.duration}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                        <div className="flex-1">
                          <div className="text-[10px] text-muted-foreground">Estimated drop</div>
                          <div className="text-sm font-semibold text-foreground tabular-nums">
                            {ride.arrivalTime || routeEstimate?.arrivalTime || "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{ride.to?.name}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Route Deviation Alert */}
            {routeDeviationAlert && (
              <div className="border border-yellow-500/50 bg-yellow-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-medium">{routeDeviationAlert}</span>
                </div>
              </div>
            )}

            {/* Safety Features - Only visible during ongoing ride */}
            {ride.status === "in-progress" && user && (
              <div className="border border-border bg-card rounded-lg p-4 space-y-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Safety Features
                </div>
                
                {/* Live Location Sharing */}
                <LiveLocationSharing
                  rideId={ride._id}
                  bookingId={userBooking?._id}
                  isRideOngoing={true}
                  onDeviationDetected={handleRouteDeviation}
                />

                {/* SOS Button */}
                <SOSButton
                  rideId={ride._id}
                  isRideOngoing={true}
                  driverName={ride.driver?.name}
                  vehicleInfo={`${ride.vehicleModel || ride.vehicleType} - ${ride.vehicleNumber || 'N/A'}`}
                />
              </div>
            )}

            {/* Ride Start Confirmation - Show when ride date is today and confirmed booking exists */}
            {userBooking && ride.status === "active" && user && (
              (() => {
                const isToday = new Date(ride.date).toDateString() === new Date().toDateString();
                const isDriver = ride.driver?._id === user._id;
                const hasDriverConfirmed = ride.rideConfirmation?.driverConfirmed;
                const hasPassengerConfirmed = ride.rideConfirmation?.passengerConfirmations?.some(
                  (c: any) => c.passenger?.toString() === user._id || c.passenger?._id === user._id
                );
                const needsConfirmation = isDriver ? !hasDriverConfirmed : !hasPassengerConfirmed;
                
                if (isToday && needsConfirmation) {
                  return (
                    <div className="border border-primary/50 bg-primary/5 rounded-lg p-4">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                        Confirm Ride Start
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {isDriver 
                          ? "Confirm that you're ready to start this ride."
                          : "Confirm that the ride has started."
                        }
                      </p>
                      <button
                        onClick={handleConfirmRideStart}
                        disabled={confirmingRideStart}
                        className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-sm transition-system hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {confirmingRideStart ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Confirming...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Confirm Ride Start
                          </>
                        )}
                      </button>
                      {ride.rideConfirmation && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          {hasDriverConfirmed && !isDriver && "Driver has confirmed"}
                          {ride.rideConfirmation.passengerConfirmations?.length > 0 && isDriver && 
                            `${ride.rideConfirmation.passengerConfirmations.length} passenger(s) confirmed`}
                        </p>
                      )}
                    </div>
                  );
                }
                
                // Show completion buttons after ride has started
                if (isToday && !needsConfirmation && isRideStarted() && ride.status === "active") {
                  if (isDriver) {
                    // Driver sees "Complete Ride" button
                    return (
                      <div className="border border-green-500/50 bg-green-500/5 rounded-lg p-4">
                        <div className="text-[10px] uppercase tracking-wider text-green-600 font-medium mb-2">
                          Ride In Progress
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          When you've dropped off all passengers, mark the ride as completed.
                        </p>
                        <button
                          onClick={handleCompleteRide}
                          disabled={completingRide}
                          className="w-full h-10 bg-green-500 text-white text-sm font-medium rounded-sm transition-system hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {completingRide ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Completing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Ride Completed
                            </>
                          )}
                        </button>
                      </div>
                    );
                  } else if (userBooking && userBooking.status !== "completed") {
                    // Passenger sees "Ride Received" button
                    return (
                      <div className="border border-blue-500/50 bg-blue-500/5 rounded-lg p-4">
                        <div className="text-[10px] uppercase tracking-wider text-blue-600 font-medium mb-2">
                          Confirm Arrival
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Confirm that you've reached your destination safely.
                        </p>
                        <button
                          onClick={handleConfirmReceived}
                          disabled={confirmingReceived}
                          className="w-full h-10 bg-blue-500 text-white text-sm font-medium rounded-sm transition-system hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {confirmingReceived ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Confirming...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Ride Received
                            </>
                          )}
                        </button>
                      </div>
                    );
                  }
                }
                
                return null;
              })()
            )}

            {/* Waitlist Button - Show when ride is full */}
            {ride.availableSeats === 0 && !userBooking && user && ride.driver?._id !== user._id && (
              <WaitlistButton rideId={ride._id} />
            )}

            {/* Booking */}
            <div className="border border-border bg-card p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Book This Ride
              </div>

              {/* Seat Selection */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Number of Seats
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSeats(Math.max(1, seats - 1))}
                    className="h-11 w-11 border-2 border-border rounded-xl hover:bg-accent hover:border-foreground/20 transition-all duration-200 active:scale-95 font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={seats <= 1}
                  >
                    −
                  </button>
                  <div className="flex-1 h-11 border-2 border-primary/20 bg-primary/5 rounded-xl flex items-center justify-center font-bold text-xl text-primary">
                    {seats}
                  </div>
                  <button
                    onClick={() => setSeats(Math.min(ride.availableSeats, seats + 1))}
                    className="h-11 w-11 border-2 border-border rounded-xl hover:bg-accent hover:border-foreground/20 transition-all duration-200 active:scale-95 font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={seats >= ride.availableSeats}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-sm mb-4">
                {/* Show segment info if proportional pricing */}
                {isProportionalPrice && userSegmentKm && totalRideKm && (
                  <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
                      <Route className="h-3.5 w-3.5" />
                      Proportional Pricing
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Your segment: <span className="font-semibold text-foreground">{userSegmentKm.toFixed(1)} km</span> of {totalRideKm.toFixed(1)} km total
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      You pay only for the distance you travel
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    ₹{effectivePrice} × {seats} seat{seats > 1 ? "s" : ""}
                  </span>
                  <span className="font-mono">₹{totalPrice}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>No booking fees</span>
                  <span className="font-mono">₹0</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="font-mono text-lg">₹{finalPrice}</span>
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

              {/* WhatsApp Notifications */}
              {!userBooking && user && ride.driver?._id !== user._id && (
                <div className="mb-4 p-3 bg-success/5 border border-success/20 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableWhatsAppNotifications}
                      onChange={(e) => setEnableWhatsAppNotifications(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-success/30 text-success focus:ring-success focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-success" />
                        WhatsApp Notifications
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Get instant updates when the driver confirms your booking, ride starts, or any changes occur
                      </div>
                    </div>
                  </label>
                </div>
              )}

              <button
                onClick={handleBook}
                disabled={
                  booking ||
                  ride.availableSeats === 0 ||
                  (user && ride.driver?._id === user._id) ||
                  !!userBooking
                }
                className="w-full h-12 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
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

              {/* Cancel Booking Button - for passengers who booked */}
              {userBooking && !isRideCompleted() && userBooking.status !== "cancelled" && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full h-12 mt-3 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Booking
                </button>
              )}

              {/* Delete Ride Button - for ride creator only */}
              {user && ride.driver?._id === user._id && !isRideCompleted() && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full h-12 mt-3 bg-destructive/10 text-destructive border-2 border-destructive/20 text-sm font-semibold rounded-xl hover:bg-destructive/20 hover:border-destructive/30 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Delete Ride
                </button>
              )}

              {/* Ride Start/Complete Buttons - Part 10 */}
              {/* Driver: Start Ride button (only on ride day, for active rides) */}
              {user && ride.driver?._id === user._id && 
               ride.status === "active" && 
               ride.date === new Date().toISOString().split("T")[0] && (
                <button
                  onClick={async () => {
                    try {
                      setConfirmingRideStart(true);
                      const result = await ridesAPI.confirmDriverStart(ride._id);
                      toast.success(result.message);
                      loadRide(); // Refresh ride data
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || "Failed to start ride");
                    } finally {
                      setConfirmingRideStart(false);
                    }
                  }}
                  disabled={confirmingRideStart}
                  className="w-full h-12 mt-3 bg-success text-success-foreground text-sm font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  {confirmingRideStart ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Start Ride
                    </>
                  )}
                </button>
              )}

              {/* Driver: Ride Completed button (only for in-progress rides) */}
              {user && ride.driver?._id === user._id && ride.status === "in-progress" && (
                <button
                  onClick={async () => {
                    try {
                      setCompletingRide(true);
                      const result = await ridesAPI.completeRide(ride._id);
                      toast.success(result.message);
                      loadRide(); // Refresh ride data
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || "Failed to complete ride");
                    } finally {
                      setCompletingRide(false);
                    }
                  }}
                  disabled={completingRide}
                  className="w-full h-12 mt-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  {completingRide ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Mark as Complete
                    </>
                  )}
                </button>
              )}

              {/* Passenger: Confirm Start button (only on ride day, for active rides) */}
              {user && userBooking && 
               ride.driver?._id !== user._id &&
               ride.status === "active" && 
               ride.date === new Date().toISOString().split("T")[0] &&
               !userBooking.rideStartConfirmed && (
                <button
                  onClick={async () => {
                    try {
                      setConfirmingRideStart(true);
                      const result = await ridesAPI.confirmPassengerStart(ride._id, userBooking._id);
                      toast.success(result.message);
                      loadRide();
                      loadUserBooking();
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || "Failed to confirm");
                    } finally {
                      setConfirmingRideStart(false);
                    }
                  }}
                  disabled={confirmingRideStart}
                  className="w-full h-12 mt-3 bg-success text-success-foreground text-sm font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  {confirmingRideStart ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      I'm Ready
                    </>
                  )}
                </button>
              )}

              {/* Passenger: Ride Received button (only for completed rides by driver) */}
              {user && userBooking && 
               ride.driver?._id !== user._id &&
               (ride.status === "in-progress" || ride.status === "completed") &&
               !userBooking.rideReceived && (
                <button
                  onClick={async () => {
                    try {
                      setConfirmingReceived(true);
                      const result = await ridesAPI.confirmRideReceived(ride._id, userBooking._id);
                      toast.success(result.message);
                      loadRide();
                      loadUserBooking();
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || "Failed to confirm");
                    } finally {
                      setConfirmingReceived(false);
                    }
                  }}
                  disabled={confirmingReceived}
                  className="w-full h-12 mt-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  {confirmingReceived ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Ride Received
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Gender Mismatch Modal */}
      {showGenderMismatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">Gender Preference Required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This ride has a gender preference restriction. Please update your gender in your profile to continue booking.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGenderMismatchModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-sm text-sm hover:bg-muted transition-system"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm hover:opacity-90 transition-system"
              >
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Co-Driver Verification Required Modal */}
      {showCoDriverModal && !showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">Driver Verification Required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This ride requires verified drivers. Complete driver verification to continue booking.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCoDriverModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-sm text-sm hover:bg-muted transition-system"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowVerificationModal(true)}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm hover:opacity-90 transition-system"
              >
                Proceed to Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Driver Verification</h3>
              <button
                onClick={() => {
                  setShowVerificationModal(false);
                  setShowCoDriverModal(false);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must be at least 18 years old
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Driving License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={drivingLicenseId}
                  onChange={(e) => setDrivingLicenseId(e.target.value.toUpperCase())}
                  placeholder="MH12-20190012345"
                  className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Driving License Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDrivingLicenseFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Vehicle Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="MH12AB1234"
                  className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Vehicle Registration Document
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setVehicleRegFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={verificationVehicleType}
                  onChange={(e) => setVerificationVehicleType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm"
                >
                  <option value="car">Car</option>
                  <option value="suv">SUV</option>
                  <option value="sedan">Sedan</option>
                  <option value="hatchback">Hatchback</option>
                  <option value="bike">Bike</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Vehicle Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setVehiclePhotoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm"
                />
              </div>

              <button
                onClick={handleVerificationSubmit}
                disabled={verifying || !drivingLicenseId || !vehicleNumber || !dateOfBirth}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:opacity-90 transition-system disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Complete Verification"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Ride Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">Delete Ride</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this ride? This action cannot be undone. 
              All bookings for this ride will be cancelled.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-border rounded-sm text-sm hover:bg-muted transition-system disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRide}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-sm text-sm hover:bg-red-600 transition-system disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Ride"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">Cancel Booking</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to cancel this ride booking? 
              You may be charged a cancellation fee based on the ride's policy.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2 border border-border rounded-sm text-sm hover:bg-muted transition-system disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-sm text-sm hover:bg-red-600 transition-system disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Confirm Cancellation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      
      {/* Booking Success Loading Animation */}
      {showBookingSuccess && (
        <LoadingAnimation
          message="Booking Confirmed!"
          subMessage="Preparing your ride details"
          onComplete={() => setShowBookingSuccess(false)}
          duration={3000}
        />
      )}
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
