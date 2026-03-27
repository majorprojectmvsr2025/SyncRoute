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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Booking", BookingSchema);
