const express = require("express");
const Notification = require("../models/Notification");
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

module.exports = router;
