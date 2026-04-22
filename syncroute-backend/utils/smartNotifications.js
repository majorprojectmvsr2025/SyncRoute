/**
 * Smart Notifications System
 * 
 * Sends personalized, rare, and useful notifications based on user preferences.
 * Designed to be non-intrusive while providing real value.
 */

const UserPreferenceProfile = require("../models/UserPreferenceProfile");
const Notification = require("../models/Notification");
const Ride = require("../models/Ride");

// Minimum intervals between notification types (in hours)
const NOTIFICATION_COOLDOWNS = {
  route_match: 24,        // Once per day for route matches
  time_reminder: 48,      // Every 2 days for time-based reminders
  preference_match: 72,   // Every 3 days for general preference matches
  weekly_summary: 168     // Once per week for summaries
};

/**
 * Check if we can send a notification of a specific type to a user
 */
async function canSendNotification(userId, notificationType) {
  const cooldownHours = NOTIFICATION_COOLDOWNS[notificationType] || 24;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  
  const recentNotif = await Notification.findOne({
    user: userId,
    "data.smartType": notificationType,
    createdAt: { $gte: new Date(Date.now() - cooldownMs) }
  });

  return !recentNotif;
}

/**
 * Check for rides on user's frequent routes
 */
async function checkRouteNotifications(userId, profile, io) {
  if (!profile.routeClusters?.length) return [];

  const notifications = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  for (const cluster of profile.routeClusters.slice(0, 2)) {
    if (!cluster.fromLocation?.name || !cluster.toLocation?.name) continue;

    // Skip if we recently sent a notification for this route
    const canSend = await canSendNotification(userId, "route_match");
    if (!canSend) continue;

    // Look for rides on this route
    const fromKeyword = cluster.fromLocation.name.split(",")[0].trim();
    const toKeyword = cluster.toLocation.name.split(",")[0].trim();

    const matchingRides = await Ride.countDocuments({
      status: "active",
      date: { $gte: tomorrow, $lt: dayAfter },
      availableSeats: { $gte: 1 },
      $or: [
        { "from.name": { $regex: fromKeyword, $options: "i" } },
        { "to.name": { $regex: toKeyword, $options: "i" } }
      ]
    });

    if (matchingRides > 0) {
      const notif = await Notification.create({
        user: userId,
        type: "ride_reminder",
        title: "Rides on your usual route",
        message: `${matchingRides} ride${matchingRides > 1 ? "s" : ""} available tomorrow on ${cluster.label}`,
        data: { 
          smartType: "route_match",
          routeLabel: cluster.label, 
          count: matchingRides 
        }
      });

      notifications.push(notif);

      // Emit via socket
      if (io) {
        io.to(`user:${userId}`).emit("notification", notif);
      }

      // Only send one route notification per check
      break;
    }
  }

  return notifications;
}

/**
 * Check for rides matching user's preferred travel time
 */
async function checkTimeNotifications(userId, profile, io) {
  if (!profile.timePreferences?.confidence || profile.timePreferences.confidence < 0.4) {
    return [];
  }

  const canSend = await canSendNotification(userId, "time_reminder");
  if (!canSend) return [];

  // Find user's preferred time slot
  const slots = ["morning", "afternoon", "evening", "night"];
  const topSlot = slots.reduce((a, b) => 
    (profile.timePreferences[a] || 0) > (profile.timePreferences[b] || 0) ? a : b
  );

  const percentage = profile.timePreferences[topSlot] || 0;
  if (percentage < 0.5) return []; // Not strong enough preference

  // Map slot to hour ranges
  const hourRanges = {
    morning: { start: 6, end: 12 },
    afternoon: { start: 12, end: 17 },
    evening: { start: 17, end: 21 },
    night: { start: 21, end: 24 }
  };

  const range = hourRanges[topSlot];
  
  // Look for upcoming rides in preferred time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const rides = await Ride.find({
    status: "active",
    date: { $gte: tomorrow, $lt: nextWeek },
    availableSeats: { $gte: 1 }
  }).limit(50).lean();

  // Filter by departure time
  const matchingRides = rides.filter(ride => {
    if (!ride.departureTime) return false;
    const hour = parseInt(ride.departureTime.split(":")[0], 10);
    return hour >= range.start && hour < range.end;
  });

  if (matchingRides.length >= 3) {
    const notif = await Notification.create({
      user: userId,
      type: "ride_reminder",
      title: `${topSlot.charAt(0).toUpperCase() + topSlot.slice(1)} rides available`,
      message: `${matchingRides.length} rides available in your preferred ${topSlot} time slot this week`,
      data: { 
        smartType: "time_reminder",
        timeSlot: topSlot,
        count: matchingRides.length 
      }
    });

    if (io) {
      io.to(`user:${userId}`).emit("notification", notif);
    }

    return [notif];
  }

  return [];
}

/**
 * Check for rides with high-rated drivers (for users who prefer reliability)
 */
async function checkDriverPreferenceNotifications(userId, profile, io) {
  if (!profile.driverPreferences || profile.driverPreferences.reliabilitySensitivity !== "high") {
    return [];
  }

  const canSend = await canSendNotification(userId, "preference_match");
  if (!canSend) return [];

  const minRating = profile.driverPreferences.minRating || 4.5;

  // Look for rides with high-rated drivers
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const rides = await Ride.find({
    status: "active",
    date: { $gte: tomorrow, $lt: nextWeek },
    availableSeats: { $gte: 1 }
  })
    .populate("driver", "rating reliabilityScore")
    .limit(100)
    .lean();

  const highRatedRides = rides.filter(ride => 
    ride.driver?.rating >= minRating || ride.driver?.reliabilityScore >= 90
  );

  if (highRatedRides.length >= 5) {
    const notif = await Notification.create({
      user: userId,
      type: "ride_reminder",
      title: "Top-rated drivers available",
      message: `${highRatedRides.length} rides with highly rated drivers available this week`,
      data: { 
        smartType: "preference_match",
        preferenceType: "driver_rating",
        count: highRatedRides.length 
      }
    });

    if (io) {
      io.to(`user:${userId}`).emit("notification", notif);
    }

    return [notif];
  }

  return [];
}

/**
 * Main function to run all smart notification checks for a user
 */
async function runSmartNotificationChecks(userId, io = null) {
  try {
    const profile = await UserPreferenceProfile.findOne({ userId });
    
    if (!profile || !profile.metadata?.isActive) {
      return { 
        checked: true, 
        notified: false, 
        reason: "No active preference profile" 
      };
    }

    const allNotifications = [];

    // Run all notification checks
    const routeNotifs = await checkRouteNotifications(userId, profile, io);
    const timeNotifs = await checkTimeNotifications(userId, profile, io);
    const driverNotifs = await checkDriverPreferenceNotifications(userId, profile, io);

    allNotifications.push(...routeNotifs, ...timeNotifs, ...driverNotifs);

    return {
      checked: true,
      notified: allNotifications.length > 0,
      notifications: allNotifications,
      count: allNotifications.length
    };
  } catch (error) {
    console.error("Smart notification check error:", error);
    return {
      checked: true,
      notified: false,
      error: error.message
    };
  }
}

/**
 * Background job to run smart notifications for all active users
 * Should be called periodically (e.g., every 6 hours)
 */
async function runBatchSmartNotifications(io = null) {
  try {
    // Get all active profiles
    const activeProfiles = await UserPreferenceProfile.find({
      "metadata.isActive": true
    }).select("userId").lean();

    let totalNotified = 0;
    let totalChecked = 0;

    for (const profile of activeProfiles) {
      const result = await runSmartNotificationChecks(profile.userId, io);
      totalChecked++;
      if (result.notified) {
        totalNotified += result.count || 1;
      }
    }

    console.log(`Smart notifications batch complete: ${totalChecked} users checked, ${totalNotified} notifications sent`);
    
    return {
      usersChecked: totalChecked,
      notificationsSent: totalNotified
    };
  } catch (error) {
    console.error("Batch smart notifications error:", error);
    throw error;
  }
}

module.exports = {
  runSmartNotificationChecks,
  runBatchSmartNotifications,
  canSendNotification,
  NOTIFICATION_COOLDOWNS
};
