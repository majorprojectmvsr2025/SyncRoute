const express = require("express");
const Notification = require("../models/Notification");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Get all notifications for current user
router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get("/unread-count", protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark single notification as read
router.patch("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.patch("/mark-all-read", protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send ride day reminders (Part 8)
 * This endpoint is meant to be called by a cron job or scheduler
 * POST /api/notifications/send-ride-reminders
 */
router.post("/send-ride-reminders", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const io = req.app.get("io");
    
    // Find all rides scheduled for today
    const todayRides = await Ride.find({
      date: today,
      status: "active"
    }).populate("driver", "name");
    
    let driverReminders = 0;
    let passengerReminders = 0;
    
    for (const ride of todayRides) {
      // Send reminder to driver
      const driverNotif = await Notification.create({
        user: ride.driver._id,
        type: "ride_reminder",
        title: "Reminder: You have a ride scheduled today",
        message: `Your ride from ${ride.from?.name || "Start"} to ${ride.to?.name || "End"} is scheduled for ${ride.departureTime || "today"}.`,
        data: { 
          rideId: ride._id,
          departureTime: ride.departureTime,
          from: ride.from?.name,
          to: ride.to?.name
        }
      });
      io.to(`user:${ride.driver._id}`).emit("notification", driverNotif);
      driverReminders++;
      
      // Find passengers with confirmed bookings
      const bookings = await Booking.find({
        ride: ride._id,
        status: { $in: ["confirmed", "pending"] }
      });
      
      for (const booking of bookings) {
        const passengerNotif = await Notification.create({
          user: booking.passenger,
          type: "ride_reminder",
          title: "Reminder: You have a ride scheduled today",
          message: `Your ride from ${ride.from?.name || "Start"} to ${ride.to?.name || "End"} with ${ride.driver.name} is scheduled for ${ride.departureTime || "today"}.`,
          data: {
            rideId: ride._id,
            bookingId: booking._id,
            departureTime: ride.departureTime,
            from: ride.from?.name,
            to: ride.to?.name,
            driverName: ride.driver.name
          }
        });
        io.to(`user:${booking.passenger}`).emit("notification", passengerNotif);
        passengerReminders++;
      }
    }
    
    res.json({
      success: true,
      message: `Sent ${driverReminders} driver reminders and ${passengerReminders} passenger reminders`,
      date: today,
      ridesCount: todayRides.length,
      driverReminders,
      passengerReminders
    });
  } catch (error) {
    console.error("Failed to send ride reminders:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
