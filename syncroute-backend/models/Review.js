const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ""
  },
  type: {
    type: String,
    enum: ["passenger-reviews-driver", "driver-reviews-passenger"],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate reviews per booking per reviewer
ReviewSchema.index({ booking: 1, reviewer: 1 }, { unique: true });

// Recalculate reviewee's average rating after save
ReviewSchema.post("save", async function () {
  try {
    const User = require("./User");
    const Review = mongoose.model("Review");
    const avg = await Review.aggregate([
      { $match: { reviewee: this.reviewee } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } }
    ]);
    if (avg.length > 0) {
      await User.findByIdAndUpdate(this.reviewee, {
        rating: Math.round(avg[0].avgRating * 10) / 10
      });
    }
  } catch (err) {
    console.error("Error updating user rating:", err);
  }
});

module.exports = mongoose.model("Review", ReviewSchema);
