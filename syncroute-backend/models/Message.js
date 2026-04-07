const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // Message type: "text" or "location"
  type: {
    type: String,
    enum: ["text", "location", "location_share", "system"],
    default: "text"
  },
  text: {
    type: String,
    trim: true
  },
  // Location sharing data
  location: {
    coordinates: {
      type: [Number], // [lng, lat]
      index: "2dsphere"
    },
    isLive: {
      type: Boolean,
      default: false
    },
    trackingToken: String, // Link to LiveTracking session
    lastUpdated: Date,
    // Static location snapshot
    snapshot: {
      address: String,
      distanceRemaining: Number, // meters
      etaMinutes: Number
    }
  },
  read: {
    type: Boolean,
    default: false
  },
  // For location messages - when sharing stops
  locationExpired: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for querying location messages
MessageSchema.index({ ride: 1, type: 1, createdAt: -1 });

// Method to update live location
MessageSchema.methods.updateLiveLocation = async function(coords, eta) {
  if (this.type !== "location" && this.type !== "location_share") return;
  
  this.location.coordinates = coords;
  this.location.lastUpdated = new Date();
  if (eta) {
    this.location.snapshot.distanceRemaining = eta.distanceRemaining;
    this.location.snapshot.etaMinutes = eta.etaMinutes;
  }
  return this.save();
};

// Method to stop live sharing
MessageSchema.methods.stopLiveSharing = async function() {
  this.location.isLive = false;
  this.locationExpired = true;
  return this.save();
};

module.exports = mongoose.model("Message", MessageSchema);
