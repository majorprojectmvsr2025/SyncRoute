const UserBehaviorAnalytics = require("../models/UserBehaviorAnalytics");
const User = require("../models/User");
const Ride = require("../models/Ride");

/**
 * Behavior Tracker Utility
 * 
 * Records user actions for ML-based preference learning.
 * All tracking is asynchronous to avoid slowing down main operations.
 */

// Helper to classify time of day
function getTimeOfDay(hour) {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// Helper to extract hour from time string "HH:MM"
function parseHour(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  return parseInt(parts[0], 10);
}

// Helper to calculate booking lead time
function calculateLeadTime(bookingDate, rideDate, departureTime) {
  try {
    const booking = new Date(bookingDate);
    const ride = new Date(rideDate);
    const [hours, mins] = (departureTime || "00:00").split(":").map(Number);
    ride.setHours(hours, mins, 0, 0);
    return Math.max(0, (ride - booking) / (1000 * 60 * 60)); // hours
  } catch {
    return null;
  }
}

/**
 * Build ride attributes object from a ride document
 */
async function buildRideAttributes(ride, driverDoc = null) {
  if (!ride) return null;

  // Get driver info if not provided
  let driver = driverDoc;
  if (!driver && ride.driver) {
    driver = typeof ride.driver === "object" ? ride.driver : 
             await User.findById(ride.driver).select("gender rating reliabilityScore trips driverVerification").lean();
  }

  const departureHour = parseHour(ride.departureTime);
  const rideDate = ride.date ? new Date(ride.date) : new Date();
  const dayOfWeek = rideDate.getDay();

  return {
    departureTime: ride.departureTime,
    departureHour,
    dayOfWeek,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,

    fromName: ride.from?.name,
    toName: ride.to?.name,
    distance: ride.estimatedDistance || 0,
    duration: ride.estimatedDuration || 0,

    price: ride.price,
    pricePerKm: ride.estimatedDistance > 0 
      ? Math.round((ride.price / (ride.estimatedDistance / 1000)) * 100) / 100 
      : null,

    driverGender: driver?.gender,
    driverRating: driver?.rating,
    driverReliabilityScore: driver?.reliabilityScore?.score,
    driverTrips: driver?.trips,
    driverVerified: driver?.driverVerification?.isVerified || false,

    vehicleType: ride.vehicleType,

    musicPreference: ride.musicPreference,
    conversationStyle: ride.conversationStyle,
    smokingAllowed: ride.smokingAllowed,
    genderPreference: ride.genderPreference,
    instantBooking: ride.instantBooking,
    requiresCoDriver: ride.requiresCoDriver,

    totalSeats: ride.totalSeats,
    availableSeats: ride.availableSeats
  };
}

/**
 * Track search event
 */
async function trackSearch(userId, searchParams, resultsCount, filtersApplied = {}) {
  try {
    const now = new Date();
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "search",
      timestamp: now,
      searchContext: {
        pickupLocation: {
          name: searchParams.fromName || null,
          coordinates: searchParams.pickupLat && searchParams.pickupLng 
            ? [searchParams.pickupLng, searchParams.pickupLat] : null
        },
        dropLocation: {
          name: searchParams.toName || null,
          coordinates: searchParams.dropLat && searchParams.dropLng 
            ? [searchParams.dropLng, searchParams.dropLat] : null
        },
        searchDate: searchParams.date ? new Date(searchParams.date) : null,
        passengers: searchParams.passengers || 1,
        resultsCount,
        filtersApplied
      },
      sessionContext: {
        timeOfAction: getTimeOfDay(now.getHours())
      }
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track search:", error.message);
  }
}

/**
 * Track ride view event
 */
async function trackRideView(userId, ride) {
  try {
    const rideAttributes = await buildRideAttributes(ride);
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "view_ride",
      timestamp: new Date(),
      rideId: ride._id,
      rideAttributes
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track ride view:", error.message);
  }
}

/**
 * Track booking created event
 */
async function trackBookingCreated(userId, booking, ride) {
  try {
    const rideAttributes = await buildRideAttributes(ride);
    const now = new Date();
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "booking_created",
      timestamp: now,
      rideId: ride._id,
      rideAttributes,
      bookingDetails: {
        seats: booking.seats,
        totalPrice: booking.totalPrice,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        bookingType: booking.status === "confirmed" ? "instant" : "waitlist",
        bookingLeadTime: calculateLeadTime(now, ride.date, ride.departureTime)
      },
      sessionContext: {
        timeOfAction: getTimeOfDay(now.getHours())
      }
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track booking:", error.message);
  }
}

/**
 * Track booking cancelled event
 */
async function trackBookingCancelled(userId, booking, ride, reason = null) {
  try {
    const rideAttributes = await buildRideAttributes(ride);
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "booking_cancelled",
      timestamp: new Date(),
      rideId: ride._id,
      rideAttributes,
      bookingDetails: {
        seats: booking.seats,
        totalPrice: booking.totalPrice
      },
      outcome: {
        status: "cancelled",
        cancellationReason: reason
      }
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track cancellation:", error.message);
  }
}

/**
 * Track booking completed event
 */
async function trackBookingCompleted(userId, booking, ride, onTime = true) {
  try {
    const rideAttributes = await buildRideAttributes(ride);
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "booking_completed",
      timestamp: new Date(),
      rideId: ride._id,
      rideAttributes,
      bookingDetails: {
        seats: booking.seats,
        totalPrice: booking.totalPrice
      },
      outcome: {
        status: "completed",
        completedOnTime: onTime
      }
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track completion:", error.message);
  }
}

/**
 * Track waitlist joined event
 */
async function trackWaitlistJoined(userId, ride, seatsRequested) {
  try {
    const rideAttributes = await buildRideAttributes(ride);
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "waitlist_joined",
      timestamp: new Date(),
      rideId: ride._id,
      rideAttributes,
      bookingDetails: {
        seats: seatsRequested,
        bookingType: "waitlist"
      }
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track waitlist:", error.message);
  }
}

/**
 * Track review submitted event
 */
async function trackReviewSubmitted(userId, booking, ride, rating) {
  try {
    const rideAttributes = await buildRideAttributes(ride);
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "review_submitted",
      timestamp: new Date(),
      rideId: ride._id,
      rideAttributes,
      outcome: {
        ratingGiven: rating
      }
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track review:", error.message);
  }
}

/**
 * Track ride created event (for drivers)
 */
async function trackRideCreated(userId, ride) {
  try {
    const rideAttributes = await buildRideAttributes(ride);
    
    await UserBehaviorAnalytics.create({
      userId,
      eventType: "ride_created",
      timestamp: new Date(),
      rideId: ride._id,
      rideAttributes
    });
  } catch (error) {
    console.error("[BehaviorTracker] Failed to track ride creation:", error.message);
  }
}

/**
 * Get user's recent behavior summary
 */
async function getRecentBehaviorSummary(userId, daysBack = 30) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const events = await UserBehaviorAnalytics.aggregate([
      {
        $match: {
          userId: new (require("mongoose")).Types.ObjectId(userId),
          timestamp: { $gte: since }
        }
      },
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
          lastEvent: { $max: "$timestamp" }
        }
      }
    ]);

    return events.reduce((acc, e) => {
      acc[e._id] = { count: e.count, lastEvent: e.lastEvent };
      return acc;
    }, {});
  } catch (error) {
    console.error("[BehaviorTracker] Failed to get summary:", error.message);
    return {};
  }
}

module.exports = {
  trackSearch,
  trackRideView,
  trackBookingCreated,
  trackBookingCancelled,
  trackBookingCompleted,
  trackWaitlistJoined,
  trackReviewSubmitted,
  trackRideCreated,
  getRecentBehaviorSummary,
  buildRideAttributes
};
