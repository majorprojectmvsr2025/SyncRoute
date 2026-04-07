const mongoose = require("mongoose");
const crypto = require("crypto");

const LiveTrackingSchema = new mongoose.Schema({
  // The user sharing their location
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // Associated ride
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true
  },
  // Associated booking (if passenger)
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking"
  },
  // Secure token for public tracking link
  trackingToken: {
    type: String,
    unique: true,
    required: true
  },
  // Current location
  currentLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: [Number] // [lng, lat]
  },
  // Location history for route tracking
  locationHistory: [{
    coordinates: [Number], // [lng, lat]
    timestamp: { type: Date, default: Date.now },
    accuracy: Number,
    speed: Number,
    heading: Number
  }],
  // ETA information
  eta: {
    destination: String,
    estimatedArrival: Date,
    distanceRemaining: Number, // meters
    durationRemaining: Number  // seconds
  },
  // Tracking status
  status: {
    type: String,
    enum: ["active", "paused", "stopped", "expired"],
    default: "active"
  },
  // Link expiration
  expiresAt: {
    type: Date,
    required: true
  },
  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  },
  stoppedAt: Date,
  // Metadata
  deviceInfo: {
    platform: String,
    browser: String
  },
  // Route deviation tracking
  plannedRoute: {
    type: {
      type: String,
      enum: ["LineString"]
    },
    coordinates: [[Number]]
  },
  deviationDetected: {
    type: Boolean,
    default: false
  },
  lastDeviationAlert: Date,
  deviationCount: {
    type: Number,
    default: 0
  }
});

// Index for geospatial queries
LiveTrackingSchema.index({ currentLocation: "2dsphere" });
LiveTrackingSchema.index({ trackingToken: 1 });
LiveTrackingSchema.index({ ride: 1, sharedBy: 1 });
LiveTrackingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Generate secure tracking token
LiveTrackingSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString("hex");
};

// Check if tracking session is valid
LiveTrackingSchema.methods.isValid = function() {
  return this.status === "active" && this.expiresAt > new Date();
};

// Update location
LiveTrackingSchema.methods.updateLocation = function(coords, meta = {}) {
  this.currentLocation = {
    type: "Point",
    coordinates: [coords.lng, coords.lat]
  };
  this.locationHistory.push({
    coordinates: [coords.lng, coords.lat],
    timestamp: new Date(),
    accuracy: meta.accuracy,
    speed: meta.speed,
    heading: meta.heading
  });
  this.lastUpdatedAt = new Date();
  
  // Keep only last 100 location points to avoid document bloat
  if (this.locationHistory.length > 100) {
    this.locationHistory = this.locationHistory.slice(-100);
  }
};

// Stop tracking
LiveTrackingSchema.methods.stopTracking = function() {
  this.status = "stopped";
  this.stoppedAt = new Date();
};

module.exports = mongoose.model("LiveTracking", LiveTrackingSchema);
