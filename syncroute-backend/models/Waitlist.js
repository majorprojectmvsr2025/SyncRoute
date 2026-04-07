const mongoose = require("mongoose");

const WaitlistSchema = new mongoose.Schema({
  // The ride user wants to join
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true
  },
  // User on the waitlist
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // Number of seats requested
  seatsRequested: {
    type: Number,
    required: true,
    min: 1
  },
  // Position in queue (1 = first)
  position: {
    type: Number,
    required: true
  },
  // Pickup and drop locations
  pickupLocation: {
    name: String,
    coordinates: [Number]
  },
  dropLocation: {
    name: String,
    coordinates: [Number]
  },
  // Status of waitlist entry
  status: {
    type: String,
    enum: ["waiting", "offered", "confirmed", "expired", "cancelled", "declined"],
    default: "waiting"
  },
  // When a seat became available and was offered
  offeredAt: Date,
  // Deadline to accept offer (5 minutes from offer)
  offerExpiresAt: Date,
  // When user responded to offer
  respondedAt: Date,
  // Timestamps
  joinedAt: {
    type: Date,
    default: Date.now
  },
  // If confirmed, link to created booking
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking"
  },
  // Notification tracking
  notificationSent: {
    type: Boolean,
    default: false
  }
});

// Compound index to prevent duplicate waitlist entries
WaitlistSchema.index({ ride: 1, user: 1 }, { unique: true });
WaitlistSchema.index({ ride: 1, status: 1, position: 1 });
WaitlistSchema.index({ offerExpiresAt: 1 });

// Static: Get next position for a ride's waitlist
WaitlistSchema.statics.getNextPosition = async function(rideId) {
  const lastEntry = await this.findOne({ ride: rideId })
    .sort({ position: -1 })
    .select("position");
  return (lastEntry?.position || 0) + 1;
};

// Static: Get active waitlist for a ride
WaitlistSchema.statics.getWaitlist = async function(rideId) {
  return this.find({
    ride: rideId,
    status: { $in: ["waiting", "offered"] }
  })
    .sort({ position: 1 })
    .populate("user", "name email phone photo");
};

// Static: Offer seat to next person in waitlist
WaitlistSchema.statics.offerSeatToNext = async function(rideId, seatsAvailable) {
  const OFFER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  
  // Find next waiting user who requested <= available seats
  const nextInLine = await this.findOne({
    ride: rideId,
    status: "waiting",
    seatsRequested: { $lte: seatsAvailable }
  })
    .sort({ position: 1 })
    .populate("user", "name email");
  
  if (!nextInLine) return null;
  
  nextInLine.status = "offered";
  nextInLine.offeredAt = new Date();
  nextInLine.offerExpiresAt = new Date(Date.now() + OFFER_TIMEOUT_MS);
  await nextInLine.save();
  
  return nextInLine;
};

// Instance: Accept offer and create booking
WaitlistSchema.methods.acceptOffer = async function() {
  if (this.status !== "offered") {
    throw new Error("No active offer to accept");
  }
  if (this.offerExpiresAt < new Date()) {
    this.status = "expired";
    await this.save();
    throw new Error("Offer has expired");
  }
  this.status = "confirmed";
  this.respondedAt = new Date();
  await this.save();
  return this;
};

// Instance: Decline offer
WaitlistSchema.methods.declineOffer = async function() {
  if (this.status !== "offered") {
    throw new Error("No active offer to decline");
  }
  this.status = "declined";
  this.respondedAt = new Date();
  await this.save();
  return this;
};

// Instance: Cancel waitlist entry
WaitlistSchema.methods.cancel = async function() {
  if (["confirmed", "expired"].includes(this.status)) {
    throw new Error("Cannot cancel this waitlist entry");
  }
  this.status = "cancelled";
  await this.save();
  return this;
};

module.exports = mongoose.model("Waitlist", WaitlistSchema);
