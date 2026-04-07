/**
 * Recurring Rides Model
 * 
 * Allows users to schedule repeating rides (daily, weekly, custom)
 * for commute patterns like Mon-Fri office trips.
 */

const mongoose = require("mongoose");

const RecurringRideSchema = new mongoose.Schema({
  // Owner of the recurring ride
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // User is driver or passenger
  role: {
    type: String,
    enum: ["driver", "passenger"],
    required: true
  },
  
  // Ride template details
  template: {
    from: {
      name: { type: String, required: true },
      coordinates: {
        type: { type: String, default: "Point" },
        coordinates: [Number] // [lng, lat]
      }
    },
    to: {
      name: { type: String, required: true },
      coordinates: {
        type: { type: String, default: "Point" },
        coordinates: [Number]
      }
    },
    departureTime: { type: String, required: true }, // "08:30"
    seats: { type: Number, default: 1 },
    price: { type: Number },
    vehicleType: String,
    preferences: {
      music: String,
      conversation: String,
      smoking: { type: Boolean, default: false },
      petsAllowed: { type: Boolean, default: false },
      genderPreference: String
    }
  },
  
  // Recurrence pattern
  recurrence: {
    type: {
      type: String,
      enum: ["daily", "weekly", "custom"],
      required: true
    },
    // For weekly/custom: which days [0=Sun, 1=Mon, ... 6=Sat]
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }],
    // How far ahead to create rides
    advanceBookingDays: {
      type: Number,
      default: 7,
      max: 30
    }
  },
  
  // Date range
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date // Optional - if not set, runs indefinitely
  },
  
  // Status
  status: {
    type: String,
    enum: ["active", "paused", "expired", "cancelled"],
    default: "active"
  },
  
  // Generated rides tracking
  generatedRides: [{
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride" },
    date: Date,
    status: {
      type: String,
      enum: ["created", "booked", "completed", "cancelled", "skipped"],
      default: "created"
    }
  }],
  
  // Last generation timestamp
  lastGeneratedDate: Date,
  
  // Skip specific dates (holidays, vacations)
  skipDates: [Date],
  
  // Notification preferences
  notifications: {
    dayBefore: { type: Boolean, default: true },
    morningOf: { type: Boolean, default: true },
    onCreation: { type: Boolean, default: true }
  },
  
  // Stats
  stats: {
    totalRidesCreated: { type: Number, default: 0 },
    totalRidesCompleted: { type: Number, default: 0 },
    totalCO2Saved: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
RecurringRideSchema.index({ user: 1, status: 1 });
RecurringRideSchema.index({ status: 1, "recurrence.type": 1 });
RecurringRideSchema.index({ lastGeneratedDate: 1 });

/**
 * Check if a specific date should have a ride
 */
RecurringRideSchema.methods.shouldCreateRideOn = function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  // Check date range
  if (targetDate < this.startDate) return false;
  if (this.endDate && targetDate > this.endDate) return false;
  
  // Check skip dates
  const isSkipped = this.skipDates.some(skip => {
    const skipDate = new Date(skip);
    skipDate.setHours(0, 0, 0, 0);
    return skipDate.getTime() === targetDate.getTime();
  });
  if (isSkipped) return false;
  
  // Check recurrence pattern
  const dayOfWeek = targetDate.getDay();
  
  switch (this.recurrence.type) {
    case "daily":
      return true;
    case "weekly":
    case "custom":
      return this.recurrence.daysOfWeek.includes(dayOfWeek);
    default:
      return false;
  }
};

/**
 * Get upcoming dates that need rides created
 */
RecurringRideSchema.methods.getUpcomingDates = function(daysAhead = null) {
  const advanceDays = daysAhead || this.recurrence.advanceBookingDays;
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i <= advanceDays; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + i);
    
    if (this.shouldCreateRideOn(checkDate)) {
      // Check if ride already generated for this date
      const alreadyGenerated = this.generatedRides.some(gr => {
        const grDate = new Date(gr.date);
        grDate.setHours(0, 0, 0, 0);
        return grDate.getTime() === checkDate.getTime();
      });
      
      if (!alreadyGenerated) {
        dates.push(checkDate);
      }
    }
  }
  
  return dates;
};

/**
 * Static method to get all recurring rides needing generation
 */
RecurringRideSchema.statics.getRecurringRidesNeedingGeneration = async function() {
  const activeRecurring = await this.find({
    status: "active",
    $or: [
      { endDate: null },
      { endDate: { $gte: new Date() } }
    ]
  }).populate("user", "name email");
  
  const needsGeneration = [];
  
  for (const recurring of activeRecurring) {
    const upcomingDates = recurring.getUpcomingDates();
    if (upcomingDates.length > 0) {
      needsGeneration.push({
        recurring,
        datesToCreate: upcomingDates
      });
    }
  }
  
  return needsGeneration;
};

module.exports = mongoose.model("RecurringRide", RecurringRideSchema);
