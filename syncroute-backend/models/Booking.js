const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true
  },
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  seats: {
    type: Number,
    required: true,
    min: 1
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending"
  },
  pickupLocation: {
    name: String,
    coordinates: [Number]
  },
  dropLocation: {
    name: String,
    coordinates: [Number]
  },
  // Ride start confirmation by passenger
  rideStartConfirmed: {
    type: Boolean,
    default: false
  },
  rideStartConfirmedAt: {
    type: Date,
    default: null
  },
  // Ride received confirmation by passenger (Part 10)
  rideReceived: {
    type: Boolean,
    default: false
  },
  rideReceivedAt: {
    type: Date,
    default: null
  },
  // Review tracking
  hasReviewed: {
    type: Boolean,
    default: false
  },
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Booking", BookingSchema);
