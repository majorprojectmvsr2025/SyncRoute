/**
 * Push Notification Routes
 * Handles FCM token registration and notification preferences
 */

const express = require("express");
const { protect } = require("../middleware/auth");
const User = require("../models/User");
const { 
  sendPushNotification, 
  isFirebaseConfigured, 
  getFCMInfo,
  NOTIFICATION_TEMPLATES 
} = require("../utils/firebasePush");

const router = express.Router();

/**
 * POST /api/push/register-token
 * Register or update FCM token for the current user
 */
router.post("/register-token", protect, async (req, res) => {
  try {
    const { token, device = 'web' } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if token already exists
    const existingTokenIndex = user.fcmTokens?.findIndex(t => t.token === token);
    
    if (existingTokenIndex >= 0) {
      // Update existing token's lastUsedAt
      user.fcmTokens[existingTokenIndex].lastUsedAt = new Date();
      user.fcmTokens[existingTokenIndex].device = device;
    } else {
      // Add new token
      if (!user.fcmTokens) {
        user.fcmTokens = [];
      }
      user.fcmTokens.push({
        token,
        device,
        createdAt: new Date(),
        lastUsedAt: new Date()
      });
    }

    // Limit to 5 tokens per user (oldest removed first)
    if (user.fcmTokens.length > 5) {
      user.fcmTokens = user.fcmTokens
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        .slice(0, 5);
    }

    await user.save();

    res.json({ 
      message: "FCM token registered successfully",
      tokenCount: user.fcmTokens.length
    });
  } catch (error) {
    console.error("FCM token registration error:", error);
    res.status(500).json({ message: "Failed to register token", error: error.message });
  }
});

/**
 * DELETE /api/push/unregister-token
 * Remove FCM token for the current user
 */
router.delete("/unregister-token", protect, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { fcmTokens: { token } }
    });

    res.json({ message: "FCM token removed successfully" });
  } catch (error) {
    console.error("FCM token removal error:", error);
    res.status(500).json({ message: "Failed to remove token", error: error.message });
  }
});

/**
 * GET /api/push/preferences
 * Get notification preferences for current user
 */
router.get("/preferences", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("notificationPreferences");
    res.json({
      preferences: user?.notificationPreferences || {
        pushEnabled: true,
        rideReminders: true,
        chatMessages: true,
        rideUpdates: true,
        sosAlerts: true,
        marketing: false
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch preferences", error: error.message });
  }
});

/**
 * PUT /api/push/preferences
 * Update notification preferences
 */
router.put("/preferences", protect, async (req, res) => {
  try {
    const allowedFields = ['pushEnabled', 'rideReminders', 'chatMessages', 'rideUpdates', 'sosAlerts', 'marketing'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (typeof req.body[field] === 'boolean') {
        updates[`notificationPreferences.${field}`] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("notificationPreferences");

    res.json({
      message: "Preferences updated",
      preferences: user.notificationPreferences
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update preferences", error: error.message });
  }
});

/**
 * POST /api/push/test
 * Send a test notification to the current user
 */
router.post("/test", protect, async (req, res) => {
  try {
    if (!isFirebaseConfigured()) {
      return res.status(503).json({ 
        message: "Push notifications not configured",
        info: getFCMInfo()
      });
    }

    const user = await User.findById(req.user._id).select("fcmTokens name");
    
    if (!user?.fcmTokens?.length) {
      return res.status(400).json({ message: "No FCM tokens registered for this user" });
    }

    // Send test notification to all user's devices
    const results = await Promise.all(
      user.fcmTokens.map(tokenObj => 
        sendPushNotification(
          tokenObj.token,
          {
            title: "🔔 Test Notification",
            body: `Hello ${user.name}! Push notifications are working correctly.`
          },
          { type: 'test', url: '/profile' }
        )
      )
    );

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      message: `Test notification sent to ${successCount}/${results.length} devices`,
      results
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to send test notification", error: error.message });
  }
});

/**
 * GET /api/push/status
 * Get push notification service status
 */
router.get("/status", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("fcmTokens notificationPreferences");
    const fcmInfo = getFCMInfo();

    res.json({
      serviceConfigured: isFirebaseConfigured(),
      fcmInfo,
      userTokenCount: user?.fcmTokens?.length || 0,
      preferences: user?.notificationPreferences || {}
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get status", error: error.message });
  }
});

module.exports = router;
