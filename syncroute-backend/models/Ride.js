const mongoose = require("mongoose");

const RideSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  from: {
    name: String,
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: [Number] // [lng, lat]
    }
  },
  to: {
    name: String,
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: [Number]
    }
  },
  routePath: {
    type: {
      type: String,
      enum: ["LineString"],
      default: "LineString"
    },
    coordinates: [[Number]]
  },
  departureTime: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  availableSeats: {
    type: Number,
    required: true,
    min: 0
  },
  totalSeats: {
    type: Number,
    required: true
  },
  vehicleType: {
    type: String,
    enum: ["Sedan", "SUV", "Compact", "Van"],
    default: "Sedan"
  },
  vehicleModel: String,
  instantBooking: {
    type: Boolean,
    default: true
  },
  genderPreference: {
    type: String,
    enum: ["any", "women-only", "men-only"],
    default: "any"
  },
  stops: [String],
  // Vibe / ride style
  musicPreference: {
    type: String,
    enum: ["none", "soft", "any"],
    default: "any"
  },
  conversationStyle: {
    type: String,
    enum: ["chatty", "quiet", "flexible"],
    default: "flexible"
  },
  smokingAllowed: {
    type: Boolean,
    default: false
  },
  // Shared driving (rider can co-drive on long trips, fare adjusted)
  sharedDriving: {
    type: Boolean,
    default: false
  },
  // OSRM estimated duration in seconds and distance in meters
  estimatedDuration: Number,
  estimatedDistance: Number,
  status: {
    type: String,
    enum: ["active", "in-progress", "completed", "cancelled"],
    default: "active"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

RideSchema.index({ routePath: "2dsphere" });

module.exports = mongoose.model("Ride", RideSchema);
