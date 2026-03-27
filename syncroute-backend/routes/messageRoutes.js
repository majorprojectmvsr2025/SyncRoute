const express = require("express");
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Send message
router.post("/send", protect, async (req, res) => {
  try {
    const { rideId, receiverId, text } = req.body;

    if (!text || !receiverId || !rideId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const message = await Message.create({
      ride: rideId,
      sender: req.user._id,
      receiver: receiverId,
      text
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name photo")
      .populate("receiver", "name photo");

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversation
router.get("/conversation/:rideId/:userId", protect, async (req, res) => {
  try {
    const { rideId, userId } = req.params;

    const messages = await Message.find({
      ride: rideId,
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    })
      .populate("sender", "name photo")
      .populate("receiver", "name photo")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all conversations for user
router.get("/conversations", protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    })
      .populate("sender", "name photo")
      .populate("receiver", "name photo")
      .populate("ride")
      .sort({ createdAt: -1 });

    const conversationsMap = new Map();

    messages.forEach(msg => {
      const otherUser = msg.sender._id.toString() === req.user._id.toString()
        ? msg.receiver
        : msg.sender;
      const key = `${msg.ride._id}-${otherUser._id}`;

      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          ride: msg.ride,
          otherUser,
          lastMessage: msg,
          unreadCount: 0
        });
      }

      // Count unread messages sent TO us by the other user
      if (
        msg.receiver._id.toString() === req.user._id.toString() &&
        !msg.read
      ) {
        conversationsMap.get(key).unreadCount += 1;
      }
    });

    const conversations = Array.from(conversationsMap.values());
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as read
router.patch("/mark-read/:rideId/:userId", protect, async (req, res) => {
  try {
    await Message.updateMany(
      {
        ride: req.params.rideId,
        sender: req.params.userId,
        receiver: req.user._id,
        read: false
      },
      { read: true }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
