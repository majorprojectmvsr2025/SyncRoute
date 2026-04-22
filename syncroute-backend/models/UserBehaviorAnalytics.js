const mongoose = require("mongoose");

/**
 * UserBehaviorAnalytics Model
 * 
 * Stores all user interactions for ML-based preference learning.
 * Each event captures context about the user's action.
 */
const UserBehaviorAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  
  // Event type classification
  eventType: {
    type: String,
    enum: [
      "search",           // User searched for rides
      "view_ride",        // User viewed ride details
      "booking_created",  // User booked a ride
      "booking_cancelled",// User cancelled booking
      "booking_completed",// Ride was completed
      "waitlist_joined",  // User joined waitlist
      "review_submitted", // User submitted review
      "ride_created"      // User created ride as driver
    ],
    required: true,
    index: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Reference to the ride (if applicable)
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride"
  },

  // Search context (for search events)
  searchContext: {
    pickupLocation: {
      name: String,
      coordinates: [Number] // [lng, lat]
    },
    dropLocation: {
      name: String,
      coordinates: [Number]
    },
    searchDate: Date,
    passengers: Number,
    resultsCount: Number,
    filtersApplied: {
      priceRange: [Number],
      departureWindow: String,
      vehicleType: String,
      minRating: Number,
      genderPreference: String,
      instantBooking: Boolean
    }
  },

  // Ride attributes at time of event
  rideAttributes: {
    departureTime: String,       // HH:MM format
    departureHour: Number,       // 0-23 for ML
    dayOfWeek: Number,           // 0-6 (Sunday-Saturday)
    isWeekend: Boolean,
    
    // Route info
    fromName: String,
    toName: String,
    distance: Number,            // meters
    duration: Number,            // seconds
    
    // Pricing
    price: Number,
    pricePerKm: Number,
    
    // Driver info
    driverGender: String,
    driverRating: Number,
    driverReliabilityScore: Number,
    driverTrips: Number,
    driverVerified: Boolean,
    
    // Vehicle info
    vehicleType: String,
    
    // Preferences
    musicPreference: String,
    conversationStyle: String,
    smokingAllowed: Boolean,
    genderPreference: String,
    instantBooking: Boolean,
    requiresCoDriver: Boolean,
    
    // Capacity
    totalSeats: Number,
    availableSeats: Number
  },

  // Booking details (for booking events)
  bookingDetails: {
    seats: Number,
    totalPrice: Number,
    pickupLocation: {
      name: String,
      coordinates: [Number]
    },
    dropLocation: {
      name: String,
      coordinates: [Number]
    },
    bookingType: String,         // "instant" or "waitlist"
    bookingLeadTime: Number      // hours between booking and ride
  },

  // Outcome (for completed/cancelled events)
  outcome: {
    status: String,              // "completed", "cancelled"
    ratingGiven: Number,         // 1-5 if review submitted
    cancellationReason: String,
    completedOnTime: Boolean
  },

  // Session context
  sessionContext: {
    deviceType: String,          // "mobile", "desktop"
    timeOfAction: String,        // "morning", "afternoon", "evening", "night"
    searchToBookSeconds: Number  // Time from first search to booking
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
UserBehaviorAnalyticsSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
UserBehaviorAnalyticsSchema.index({ userId: 1, "rideAttributes.departureHour": 1 });
UserBehaviorAnalyticsSchema.index({ userId: 1, "rideAttributes.dayOfWeek": 1 });
UserBehaviorAnalyticsSchema.index({ userId: 1, "rideAttributes.vehicleType": 1 });

// TTL index - automatically delete events older than 1 year
UserBehaviorAnalyticsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model("UserBehaviorAnalytics", UserBehaviorAnalyticsSchema);
