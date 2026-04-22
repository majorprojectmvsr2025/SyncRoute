const express = require("express");
const Booking = require("../models/Booking");
const Ride = require("../models/Ride");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { trackBookingCreated, trackBookingCancelled, trackBookingCompleted } = require("../utils/behaviorTracker");

const router = express.Router();

// Helper to emit notification via socket
async function emitNotification(req, userId, notifData) {
  const notification = await Notification.create({ user: userId, ...notifData });
  const io = req.app.get("io");
  io.to(`user:${userId}`).emit("notification", notification);
  return notification;
}

// Create booking
router.post("/create", protect, async (req, res) => {
  try {
    const { rideId, seats, pickupLocation, dropLocation } = req.body;

    const ride = await Ride.findById(rideId).populate("driver");
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.driver._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot book your own ride" });
    }

    if (ride.availableSeats < seats) {
      return res.status(400).json({ message: "Not enough seats available" });
    }

    // Get the booking user's full profile
    const bookingUser = await User.findById(req.user._id);
    if (!bookingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Gender preference validation
    if (ride.genderPreference && ride.genderPreference !== "any") {
      const userGender = bookingUser.gender;
      
      // Check if user has specified their gender
      if (!userGender || userGender === "prefer_not_to_say") {
        return res.status(400).json({ 
          message: "This ride has a gender preference. Please update your profile with your gender to book this ride.",
          code: "GENDER_NOT_SPECIFIED"
        });
      }
      
      // Check gender match
      if (ride.genderPreference === "women-only" && userGender !== "female") {
        return res.status(400).json({ 
          message: "This ride is restricted to female passengers only.",
          code: "GENDER_MISMATCH"
        });
      }
      
      if (ride.genderPreference === "men-only" && userGender !== "male") {
        return res.status(400).json({ 
          message: "This ride is restricted to male passengers only.",
          code: "GENDER_MISMATCH"
        });
      }
    }

    // Co-driver verification check
    if (ride.requiresCoDriver || ride.sharedDriving) {
      const isDriverVerified = bookingUser.driverVerification?.isVerified === true;
      
      if (!isDriverVerified) {
        return res.status(400).json({
          message: "This ride requires verified drivers. Please complete driver verification to book this ride.",
          code: "DRIVER_VERIFICATION_REQUIRED"
        });
      }
    }

    const totalPrice = ride.price * seats;
    const bookingStatus = ride.instantBooking ? "confirmed" : "pending";

    const booking = await Booking.create({
      ride: rideId,
      passenger: req.user._id,
      driver: ride.driver._id,
      seats,
      totalPrice,
      pickupLocation,
      dropLocation,
      status: bookingStatus
    });

    ride.availableSeats -= seats;
    await ride.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("ride")
      .populate("passenger", "-password")
      .populate("driver", "-password");

    // Notify driver
    const notifType = bookingStatus === "confirmed" ? "booking_confirmed" : "booking_pending";
    await emitNotification(req, ride.driver._id, {
      type: notifType,
      title: bookingStatus === "confirmed" ? "New booking confirmed" : "New booking request",
      message: `${req.user.name} booked ${seats} seat(s) on your ride from ${ride.from?.name} to ${ride.to?.name}`,
      data: { bookingId: booking._id, rideId }
    });

    // Notify passenger
    if (bookingStatus === "confirmed") {
      await emitNotification(req, req.user._id, {
        type: "booking_confirmed",
        title: "Booking confirmed",
        message: `Your booking for ${ride.from?.name} → ${ride.to?.name} is confirmed`,
        data: { bookingId: booking._id, rideId }
      });
    }

    // Track behavior for ML (async, don't await)
    trackBookingCreated(req.user._id, populatedBooking, ride);

    res.status(201).json(populatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get user bookings
router.get("/my-bookings", protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ passenger: req.user._id })
      .populate("ride")
      .populate("driver", "-password")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get booking by ID
router.get("/:id", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("ride")
      .populate("passenger", "-password")
      .populate("driver", "-password");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bookings for driver's rides
router.get("/driver/ride-bookings", protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ driver: req.user._id })
      .populate("ride")
      .populate("passenger", "-password")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel booking
router.patch("/:id/cancel", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("ride");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.passenger.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    booking.status = "cancelled";
    await booking.save();

    const ride = await Ride.findById(booking.ride._id || booking.ride);
    if (ride) {
      ride.availableSeats += booking.seats;
      await ride.save();
    }

    // Notify driver
    await emitNotification(req, booking.driver, {
      type: "booking_cancelled",
      title: "Booking cancelled",
      message: `A passenger cancelled their booking for ${booking.ride?.from?.name} → ${booking.ride?.to?.name}`,
      data: { bookingId: booking._id }
    });

    // Track cancellation behavior for ML (async)
    trackBookingCancelled(req.user._id, booking, ride);

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm booking (driver action)
router.patch("/:id/confirm", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("ride");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: "Booking is not in pending state" });
    }

    booking.status = "confirmed";
    await booking.save();

    // Notify passenger
    await emitNotification(req, booking.passenger, {
      type: "booking_confirmed",
      title: "Booking confirmed",
      message: `Your booking for ${booking.ride?.from?.name} → ${booking.ride?.to?.name} has been confirmed by the driver`,
      data: { bookingId: booking._id, rideId: booking.ride?._id }
    });

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject booking (driver action)
router.patch("/:id/reject", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("ride");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: "Booking is not in pending state" });
    }

    booking.status = "rejected";
    await booking.save();

    // Restore available seats
    const ride = await Ride.findById(booking.ride._id || booking.ride);
    if (ride) {
      ride.availableSeats += booking.seats;
      await ride.save();
    }

    // Notify passenger
    await emitNotification(req, booking.passenger, {
      type: "booking_rejected",
      title: "Booking request declined",
      message: `Your booking request for ${booking.ride?.from?.name} → ${booking.ride?.to?.name} was declined by the driver`,
      data: { bookingId: booking._id, rideId: booking.ride?._id }
    });

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete booking (driver action)
router.patch("/:id/complete", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("ride");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!["confirmed", "pending"].includes(booking.status)) {
      return res.status(400).json({ message: "Cannot complete this booking" });
    }

    booking.status = "completed";
    await booking.save();

    // Increment trip counts and update ride stats
    await User.findByIdAndUpdate(booking.passenger, { 
      $inc: { 
        trips: 1,
        "rideStats.totalRidesAsPassenger": 1
      },
      $set: { "rideStats.lastRideDate": new Date() }
    });
    await User.findByIdAndUpdate(booking.driver, { 
      $inc: { 
        trips: 1,
        "rideStats.totalRidesAsDriver": 1 
      },
      $set: { "rideStats.lastRideDate": new Date() }
    });

    // Notify passenger
    await emitNotification(req, booking.passenger, {
      type: "ride_completed",
      title: "Ride completed",
      message: `Your ride from ${booking.ride?.from?.name} to ${booking.ride?.to?.name} is complete. Leave a review!`,
      data: { bookingId: booking._id, rideId: booking.ride?._id }
    });

    // Notify driver
    await emitNotification(req, booking.driver, {
      type: "ride_completed",
      title: "Ride completed",
      message: `Your ride from ${booking.ride?.from?.name} to ${booking.ride?.to?.name} is complete`,
      data: { bookingId: booking._id, rideId: booking.ride?._id }
    });

    // Track completion behavior for ML (async)
    trackBookingCompleted(booking.passenger, booking, booking.ride);

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
