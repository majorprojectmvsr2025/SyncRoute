const express = require("express");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Create a review
router.post("/", protect, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ message: "bookingId and rating are required" });
    }

    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const booking = await Booking.findById(bookingId)
      .populate("ride")
      .populate("passenger", "name")
      .populate("driver", "name");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ message: "Can only review completed rides" });
    }

    const isPassenger = booking.passenger._id.toString() === req.user._id.toString();
    const isDriver = booking.driver._id.toString() === req.user._id.toString();

    if (!isPassenger && !isDriver) {
      return res.status(403).json({ message: "Not authorized to review this booking" });
    }

    const reviewee = isPassenger ? booking.driver._id : booking.passenger._id;
    const type = isPassenger ? "passenger-reviews-driver" : "driver-reviews-passenger";

    const review = await Review.create({
      reviewer: req.user._id,
      reviewee,
      ride: booking.ride._id,
      booking: bookingId,
      rating: ratingNum,
      comment: comment?.trim()?.substring(0, 500) || "",
      type
    });

    const populated = await Review.findById(review._id)
      .populate("reviewer", "name photo");

    // Create notification for reviewee
    const notification = await Notification.create({
      user: reviewee,
      type: "review_received",
      title: "New review received",
      message: `${req.user.name} left you a ${ratingNum}-star review`,
      data: { reviewId: review._id, rideId: booking.ride._id }
    });

    // Emit socket notification
    const io = req.app.get("io");
    io.to(`user:${reviewee}`).emit("notification", notification);

    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "You have already reviewed this booking" });
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get reviews for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate("reviewer", "name photo")
      .sort({ createdAt: -1 });

    const avgRating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      reviews,
      count: reviews.length,
      avgRating: Math.round(avgRating * 10) / 10
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if user already reviewed a booking
router.get("/booking/:bookingId", protect, async (req, res) => {
  try {
    const review = await Review.findOne({
      booking: req.params.bookingId,
      reviewer: req.user._id
    });

    res.json({ review: review || null, hasReviewed: !!review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
