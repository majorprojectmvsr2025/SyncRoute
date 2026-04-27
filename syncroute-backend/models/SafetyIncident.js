const mongoose = require("mongoose");

const SafetyIncidentSchema = new mongoose.Schema({
  // Incident details
  type: {
    type: String,
    enum: [
      "unsafe_driving",
      "harassment",
      "route_deviation",
      "accident",
      "vehicle_issue",
      "driver_behavior",
      "passenger_behavior",
      "other"
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium"
  },
  
  // Related entities
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking"
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reportedAgainst: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  // Incident information
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: [Number] // [lng, lat]
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  
  // Evidence
  evidence: [{
    type: {
      type: String,
      enum: ["photo", "audio", "video", "screenshot"],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Emergency response
  emergencyContacted: {
    type: Boolean,
    default: false
  },
  policeReportFiled: {
    type: Boolean,
    default: false
  },
  policeReportNumber: {
    type: String
  },
  
  // Resolution
  status: {
    type: String,
    enum: ["reported", "under_review", "resolved", "escalated", "dismissed"],
    default: "reported"
  },
  resolution: {
    action: {
      type: String,
      enum: [
        "warning_issued",
        "account_suspended",
        "account_banned",
        "no_action",
        "referred_to_authorities",
        "other"
      ]
    },
    notes: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    resolvedAt: Date
  },
  
  // Admin notes
  adminNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
SafetyIncidentSchema.index({ ride: 1 });
SafetyIncidentSchema.index({ reportedBy: 1 });
SafetyIncidentSchema.index({ reportedAgainst: 1 });
SafetyIncidentSchema.index({ status: 1, createdAt: -1 });
SafetyIncidentSchema.index({ severity: 1, status: 1 });
SafetyIncidentSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("SafetyIncident", SafetyIncidentSchema);
