const express = require("express");
const Message = require("../models/Message");
const LiveTracking = require("../models/LiveTracking");
const Notification = require("../models/Notification");
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
      type: "text",
      text
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name photo")
      .populate("receiver", "name photo");

    // Create notification for receiver
    try {
      await Notification.create({
        user: receiverId,
        type: "new_message",
        title: "New Message",
        message: `${req.user.name || "Someone"}: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
        data: {
          rideId,
          senderId: req.user._id.toString(),
          senderName: req.user.name,
          messageId: message._id.toString()
        }
      });
    } catch (notifErr) {
      console.error("Failed to create message notification:", notifErr);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Share live location in chat
router.post("/share-location", protect, async (req, res) => {
  try {
    const { rideId, receiverId, coordinates, address, trackingToken } = req.body;

    if (!receiverId || !rideId || !coordinates) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create location message
    const message = await Message.create({
      ride: rideId,
      sender: req.user._id,
      receiver: receiverId,
      type: "location_share",
      text: "Shared live location",
      location: {
        coordinates: [coordinates.lng, coordinates.lat],
        isLive: !!trackingToken,
        trackingToken,
        lastUpdated: new Date(),
        snapshot: {
          address: address || "Current location"
        }
      }
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name photo")
      .populate("receiver", "name photo");

    // Emit to socket
    const io = req.app.get("io");
    io.to(`ride:${rideId}`).emit("message_received", populatedMessage);
    io.to(`user:${receiverId}`).emit("location_shared", {
      messageId: message._id,
      sender: req.user._id,
      coordinates,
      isLive: !!trackingToken
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Update live location in chat message
router.patch("/location/:messageId/update", protect, async (req, res) => {
  try {
    const { coordinates, distanceRemaining, etaMinutes } = req.body;

    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (message.type !== "location_share" || !message.location?.isLive) {
      return res.status(400).json({ message: "This is not a live location message" });
    }

    // Update location
    message.location.coordinates = [coordinates.lng, coordinates.lat];
    message.location.lastUpdated = new Date();
    // Initialize snapshot if it doesn't exist
    if (!message.location.snapshot) {
      message.location.snapshot = {};
    }
    message.location.snapshot.distanceRemaining = distanceRemaining;
    message.location.snapshot.etaMinutes = etaMinutes;
    await message.save();

    // Emit update to receiver
    const io = req.app.get("io");
    io.to(`user:${message.receiver}`).emit("location_updated", {
      messageId: message._id,
      coordinates,
      distanceRemaining,
      etaMinutes,
      lastUpdated: message.location.lastUpdated
    });

    res.json({ success: true, message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Stop live location sharing
router.patch("/location/:messageId/stop", protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    message.location.isLive = false;
    message.locationExpired = true;
    await message.save();

    // Emit stop to receiver
    const io = req.app.get("io");
    io.to(`user:${message.receiver}`).emit("location_stopped", {
      messageId: message._id
    });

    res.json({ success: true, message: "Location sharing stopped" });
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

    // For live location messages, check if tracking is still active
    for (const msg of messages) {
      if (msg.type === "location_share" && msg.location?.isLive && msg.location?.trackingToken) {
        const tracking = await LiveTracking.findOne({ 
          trackingToken: msg.location.trackingToken,
          status: "active"
        });
        
        if (!tracking) {
          msg.location.isLive = false;
          msg.locationExpired = true;
          await msg.save();
        } else if (tracking.currentLocation) {
          // Update with latest location from tracking
          msg.location.coordinates = tracking.currentLocation.coordinates;
          msg.location.lastUpdated = tracking.updatedAt;
          if (tracking.eta) {
            if (!msg.location.snapshot) {
              msg.location.snapshot = {};
            }
            msg.location.snapshot.distanceRemaining = tracking.eta.distanceRemaining;
            msg.location.snapshot.etaMinutes = Math.round(tracking.eta.durationRemaining / 60);
          }
        }
      }
    }

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
          unreadCount: 0,
          hasLiveLocation: false
        });
      }

      // Check for active live location sharing
      if (msg.type === "location_share" && msg.location?.isLive && !msg.locationExpired) {
        conversationsMap.get(key).hasLiveLocation = true;
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
