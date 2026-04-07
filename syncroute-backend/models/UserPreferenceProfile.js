const mongoose = require("mongoose");

/**
 * UserPreferenceProfile Model
 * 
 * Stores computed preference vectors derived from user behavior.
 * Updated periodically by the preference analyzer.
 */
const UserPreferenceProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },

  // ═══════════════════════════════════════════════════════════════
  // TIME PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  timePreferences: {
    // Distribution across time slots (should sum to 1.0)
    morning: { type: Number, default: 0.25 },    // 6:00 - 12:00
    afternoon: { type: Number, default: 0.25 },  // 12:00 - 17:00
    evening: { type: Number, default: 0.25 },    // 17:00 - 21:00
    night: { type: Number, default: 0.25 },      // 21:00 - 6:00
    
    // Peak hours (most frequent departure times)
    peakHours: [Number],  // e.g., [8, 9, 18] for 8AM, 9AM, 6PM
    
    // Confidence level (0-1) based on data volume
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // DAY PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  dayPreferences: {
    // Distribution across days (should sum to 1.0)
    weekdays: { type: Number, default: 0.71 },   // Mon-Fri (5/7)
    weekends: { type: Number, default: 0.29 },   // Sat-Sun (2/7)
    
    // Per-day preference scores (0-1)
    byDay: {
      sunday: { type: Number, default: 0.14 },
      monday: { type: Number, default: 0.14 },
      tuesday: { type: Number, default: 0.14 },
      wednesday: { type: Number, default: 0.14 },
      thursday: { type: Number, default: 0.14 },
      friday: { type: Number, default: 0.15 },
      saturday: { type: Number, default: 0.15 }
    },
    
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // DRIVER PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  driverPreferences: {
    // Gender preference (null = no preference)
    genderPreference: {
      type: String,
      enum: ["male", "female", "any", null],
      default: null
    },
    genderPreferenceStrength: { type: Number, default: 0 }, // 0-1
    
    // Minimum acceptable rating (1-5)
    minRating: { type: Number, default: 3.0 },
    avgBookedRating: { type: Number, default: 4.0 },
    
    // Reliability sensitivity (0-1, higher = prefers reliable drivers)
    reliabilitySensitivity: { type: Number, default: 0.5 },
    
    // Verified driver preference (0-1)
    verifiedPreference: { type: Number, default: 0.5 },
    
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // VEHICLE PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  vehiclePreferences: {
    // Distribution across vehicle types
    sedan: { type: Number, default: 0.25 },
    suv: { type: Number, default: 0.25 },
    compact: { type: Number, default: 0.25 },
    van: { type: Number, default: 0.25 },
    
    // Primary preference (most frequently booked)
    primary: { type: String, default: null },
    
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // PRICE PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  pricePreferences: {
    // Comfortable price range
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 2000 },
    avgPrice: { type: Number, default: 200 },
    
    // Price per km comfort zone
    avgPricePerKm: { type: Number, default: 5 },
    
    // Price sensitivity (0-1, higher = more price sensitive)
    sensitivity: { type: Number, default: 0.5 },
    
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // DISTANCE PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  distancePreferences: {
    // Typical distance ranges (in km)
    short: { type: Number, default: 0.33 },      // < 10km
    medium: { type: Number, default: 0.34 },     // 10-50km
    long: { type: Number, default: 0.33 },       // > 50km
    
    avgDistance: { type: Number, default: 25 },  // km
    maxDistance: { type: Number, default: 100 }, // km
    
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // COMFORT PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  comfortPreferences: {
    // Music preference distribution
    music: {
      none: { type: Number, default: 0.33 },
      soft: { type: Number, default: 0.34 },
      any: { type: Number, default: 0.33 }
    },
    musicPrimary: { type: String, default: null },
    
    // Conversation style distribution
    conversation: {
      chatty: { type: Number, default: 0.33 },
      quiet: { type: Number, default: 0.33 },
      flexible: { type: Number, default: 0.34 }
    },
    conversationPrimary: { type: String, default: null },
    
    // Smoking preference
    smokingTolerance: { type: Number, default: 0.5 }, // 0 = never, 1 = doesn't matter
    
    // Seat availability preference (prefers less crowded)
    crowdingTolerance: { type: Number, default: 0.5 }, // 0 = prefers empty, 1 = doesn't matter
    
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // BOOKING STYLE PREFERENCES
  // ═══════════════════════════════════════════════════════════════
  
  bookingStyle: {
    // Instant vs waitlist preference
    instantBookingPreference: { type: Number, default: 0.7 },
    waitlistTolerance: { type: Number, default: 0.3 },
    
    // Planning style
    avgBookingLeadHours: { type: Number, default: 24 },
    lastMinuteBooker: { type: Boolean, default: false }, // books < 2 hours before
    advancePlanner: { type: Boolean, default: false },   // books > 48 hours before
    
    // Co-driver preference
    coDriverPreference: { type: Number, default: 0 },
    
    confidence: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════
  // ROUTE CLUSTERS (Frequent Routes)
  // ═══════════════════════════════════════════════════════════════
  
  routeClusters: [{
    // Cluster center points
    fromLocation: {
      name: String,
      coordinates: [Number]  // [lng, lat]
    },
    toLocation: {
      name: String,
      coordinates: [Number]
    },
    
    // Frequency and recency
    frequency: Number,       // Number of times traveled
    lastTraveled: Date,
    
    // Typical travel patterns for this route
    typicalDepartureHour: Number,
    typicalDays: [Number],   // [1, 2, 3, 4, 5] for Mon-Fri
    
    // Cluster label (auto-generated)
    label: String            // e.g., "Home → Office", "Daily Commute"
  }],

  // ═══════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════
  
  metadata: {
    // Analysis statistics
    totalEventsAnalyzed: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    totalSearches: { type: Number, default: 0 },
    
    // Last analysis timestamp
    lastAnalyzedAt: { type: Date, default: null },
    
    // Profile version (for ML model compatibility)
    profileVersion: { type: Number, default: 1 },
    
    // Overall confidence (weighted average of all confidences)
    overallConfidence: { type: Number, default: 0 },
    
    // Is profile active (enough data to be useful)
    isActive: { type: Boolean, default: false }
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
UserPreferenceProfileSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for finding stale profiles that need re-analysis
UserPreferenceProfileSchema.index({ "metadata.lastAnalyzedAt": 1 });

module.exports = mongoose.model("UserPreferenceProfile", UserPreferenceProfileSchema);
