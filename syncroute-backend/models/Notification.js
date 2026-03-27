const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: [
      "booking_confirmed",
      "booking_cancelled",
      "booking_pending",
      "new_message",
      "ride_reminder",
      "review_received",
      "ride_started",
      "ride_completed"
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model("Notification", NotificationSchema);
