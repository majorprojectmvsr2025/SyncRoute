/**
 * Notification Queue System
 * 
 * Provides asynchronous notification processing with:
 * - In-memory queue with Redis fallback capability
 * - Retry mechanism for failed deliveries
 * - Priority-based processing
 * - Rate limiting to prevent spam
 * - Batch processing for efficiency
 * - Firebase Cloud Messaging integration for push notifications
 */

const Notification = require("../models/Notification");
const User = require("../models/User");

// Import Firebase push (graceful fallback if not configured)
let firebasePush = null;
try {
  firebasePush = require("./firebasePush");
} catch (err) {
  console.log("[NotificationQueue] Firebase push not available:", err.message);
}

// Queue configuration
const QUEUE_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 5000,
  batchSize: 10,
  processingIntervalMs: 1000,
  rateLimitPerUser: 10, // max notifications per minute per user
  priorityLevels: {
    critical: 0,  // SOS alerts
    high: 1,      // Booking confirmations
    medium: 2,    // Ride updates
    low: 3        // Recommendations
  }
};

// In-memory queue (can be replaced with Redis in production)
class NotificationQueue {
  constructor() {
    this.queues = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    this.processing = false;
    this.rateLimits = new Map(); // userId -> { count, resetTime }
    this.failedJobs = [];
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      dropped: 0
    };
  }

  /**
   * Add notification to queue
   */
  async enqueue(notification, priority = "medium") {
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notification,
      priority,
      attempts: 0,
      createdAt: new Date(),
      status: "pending"
    };

    // Check rate limit
    if (!this.checkRateLimit(notification.userId)) {
      console.log(`Rate limit exceeded for user ${notification.userId}, dropping notification`);
      this.stats.dropped++;
      return { success: false, reason: "rate_limit" };
    }

    // Add to appropriate queue
    const queuePriority = QUEUE_CONFIG.priorityLevels[priority] !== undefined 
      ? priority 
      : "medium";
    
    this.queues[queuePriority].push(job);
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return { success: true, jobId: job.id };
  }

  /**
   * Check and update rate limit
   */
  checkRateLimit(userId) {
    const userIdStr = userId.toString();
    const now = Date.now();
    const limit = this.rateLimits.get(userIdStr);

    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(userIdStr, {
        count: 1,
        resetTime: now + 60000 // 1 minute window
      });
      return true;
    }

    if (limit.count >= QUEUE_CONFIG.rateLimitPerUser) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Start processing queue
   */
  startProcessing() {
    if (this.processing) return;
    this.processing = true;
    this.processLoop();
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    while (this.processing) {
      const batch = this.getBatch();
      
      if (batch.length === 0) {
        // No jobs to process, stop
        this.processing = false;
        break;
      }

      // Process batch
      await Promise.all(batch.map(job => this.processJob(job)));

      // Wait before next batch
      await this.sleep(QUEUE_CONFIG.processingIntervalMs);
    }
  }

  /**
   * Get batch of jobs to process
   */
  getBatch() {
    const batch = [];
    const priorities = ["critical", "high", "medium", "low"];

    for (const priority of priorities) {
      while (
        batch.length < QUEUE_CONFIG.batchSize && 
        this.queues[priority].length > 0
      ) {
        batch.push(this.queues[priority].shift());
      }
    }

    return batch;
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    try {
      job.status = "processing";
      job.attempts++;

      // Create notification in database
      await this.deliverNotification(job.notification);

      job.status = "completed";
      this.stats.processed++;

      // Emit via socket if available
      this.emitNotification(job.notification);
      
      // Send push notification via FCM if available
      await this.sendPushNotification(job.notification, job.priority);

    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
      job.status = "failed";
      job.lastError = error.message;

      // Retry if under max attempts
      if (job.attempts < QUEUE_CONFIG.maxRetries) {
        this.stats.retried++;
        setTimeout(() => {
          this.queues[job.priority].push(job);
          if (!this.processing) {
            this.startProcessing();
          }
        }, QUEUE_CONFIG.retryDelayMs * job.attempts);
      } else {
        this.stats.failed++;
        this.failedJobs.push(job);
      }
    }
  }
  
  /**
   * Send push notification via Firebase Cloud Messaging
   */
  async sendPushNotification(data, priority) {
    if (!firebasePush || !firebasePush.isFirebaseConfigured()) {
      return; // FCM not configured, skip silently
    }
    
    try {
      // Get user's FCM tokens and notification preferences
      const user = await User.findById(data.userId)
        .select("fcmTokens notificationPreferences name");
      
      if (!user?.fcmTokens?.length) {
        return; // No FCM tokens registered
      }
      
      // Check if push notifications are enabled for this type
      const prefs = user.notificationPreferences || {};
      if (!prefs.pushEnabled) {
        return; // Push disabled globally
      }
      
      // Check specific notification type preferences
      const typeMapping = {
        'booking_confirmed': 'rideUpdates',
        'booking_cancelled': 'rideUpdates',
        'booking_pending': 'rideUpdates',
        'new_message': 'chatMessages',
        'ride_reminder': 'rideReminders',
        'ride_started': 'rideUpdates',
        'ride_completed': 'rideUpdates',
        'sos_alert': 'sosAlerts'
      };
      
      const prefKey = typeMapping[data.type];
      if (prefKey && prefs[prefKey] === false) {
        return; // This notification type is disabled
      }
      
      // Build notification payload
      const notification = {
        title: data.title,
        body: data.message
      };
      
      const pushData = {
        type: data.type,
        notificationId: data.notificationId || '',
        url: data.url || '/',
        priority: priority,
        ...data.metadata
      };
      
      // Send to all user's devices
      const tokens = user.fcmTokens.map(t => t.token);
      const result = await firebasePush.sendMulticastPush(tokens, notification, pushData);
      
      // Remove invalid tokens
      if (result.failedTokens?.length > 0) {
        await User.findByIdAndUpdate(data.userId, {
          $pull: { fcmTokens: { token: { $in: result.failedTokens } } }
        });
        console.log(`[NotificationQueue] Removed ${result.failedTokens.length} invalid FCM tokens`);
      }
      
    } catch (error) {
      console.error("[NotificationQueue] Push notification error:", error.message);
      // Don't throw - push failures shouldn't affect in-app notifications
    }
  }

  /**
   * Deliver notification to database
   */
  async deliverNotification(data) {
    const notification = await Notification.create({
      user: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || "general",
      metadata: data.metadata || {},
      read: false
    });

    return notification;
  }

  /**
   * Emit notification via WebSocket
   */
  emitNotification(data) {
    // This will be called by the server with the actual socket.io instance
    if (this.io) {
      this.io.to(`user:${data.userId}`).emit("notification", {
        title: data.title,
        message: data.message,
        type: data.type
      });
    }
  }

  /**
   * Set socket.io instance
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      ...this.stats,
      queueLengths: {
        critical: this.queues.critical.length,
        high: this.queues.high.length,
        medium: this.queues.medium.length,
        low: this.queues.low.length
      },
      failedJobsCount: this.failedJobs.length,
      isProcessing: this.processing
    };
  }

  /**
   * Retry failed jobs
   */
  async retryFailed() {
    const jobs = [...this.failedJobs];
    this.failedJobs = [];

    for (const job of jobs) {
      job.attempts = 0;
      this.queues[job.priority].push(job);
    }

    if (!this.processing && jobs.length > 0) {
      this.startProcessing();
    }

    return { retriedCount: jobs.length };
  }

  /**
   * Clear queue
   */
  clear() {
    this.queues = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const notificationQueue = new NotificationQueue();

/**
 * Notification types with automatic priority assignment
 */
const NotificationTypes = {
  // Critical (SOS)
  SOS_ALERT: { type: "sos", priority: "critical" },
  EMERGENCY: { type: "emergency", priority: "critical" },
  
  // High (Bookings)
  BOOKING_CONFIRMED: { type: "booking_confirmed", priority: "high" },
  BOOKING_CANCELLED: { type: "booking_cancelled", priority: "high" },
  RIDE_STARTING: { type: "ride_starting", priority: "high" },
  RIDE_COMPLETED: { type: "ride_completed", priority: "high" },
  
  // Medium (Updates)
  SEAT_AVAILABLE: { type: "seat_available", priority: "medium" },
  RIDE_UPDATE: { type: "ride_update", priority: "medium" },
  MESSAGE_RECEIVED: { type: "message", priority: "medium" },
  LOCATION_SHARED: { type: "location_shared", priority: "medium" },
  
  // Low (Recommendations)
  RIDE_RECOMMENDATION: { type: "recommendation", priority: "low" },
  DRIVER_SUGGESTION: { type: "driver_suggestion", priority: "low" },
  PRICE_DROP: { type: "price_drop", priority: "low" },
  WEEKLY_STATS: { type: "weekly_stats", priority: "low" }
};

/**
 * Helper function to send notification via queue
 */
async function sendNotification(userId, title, message, notificationType = null) {
  const typeInfo = notificationType || { type: "general", priority: "medium" };
  
  return notificationQueue.enqueue({
    userId,
    title,
    message,
    type: typeInfo.type,
    metadata: { timestamp: new Date().toISOString() }
  }, typeInfo.priority);
}

/**
 * Send batch notifications (e.g., to all passengers of a ride)
 */
async function sendBatchNotifications(userIds, title, message, notificationType = null) {
  const results = await Promise.all(
    userIds.map(userId => sendNotification(userId, title, message, notificationType))
  );
  
  return {
    total: results.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  };
}

/**
 * Notification templates for common events
 */
const NotificationTemplates = {
  bookingConfirmed: (rideDetails) => ({
    title: "Booking Confirmed! 🎉",
    message: `Your ride from ${rideDetails.from} to ${rideDetails.to} on ${rideDetails.date} has been confirmed.`,
    type: NotificationTypes.BOOKING_CONFIRMED
  }),

  bookingCancelled: (rideDetails, reason) => ({
    title: "Booking Cancelled",
    message: `Your booking for the ride from ${rideDetails.from} to ${rideDetails.to} has been cancelled. ${reason || ""}`,
    type: NotificationTypes.BOOKING_CANCELLED
  }),

  rideStarting: (rideDetails, minutesAway) => ({
    title: "Ride Starting Soon! 🚗",
    message: `Your ride to ${rideDetails.to} is starting in ${minutesAway} minutes. Driver is on the way!`,
    type: NotificationTypes.RIDE_STARTING
  }),

  rideCompleted: (rideDetails, carbonSaved) => ({
    title: "Ride Completed ✅",
    message: `You've arrived at ${rideDetails.to}! You saved ${carbonSaved}kg of CO₂ by carpooling.`,
    type: NotificationTypes.RIDE_COMPLETED
  }),

  sosAlert: (userName, location) => ({
    title: "⚠️ EMERGENCY SOS ALERT",
    message: `${userName} has triggered an SOS alert. Location: ${location}. Please check on them immediately.`,
    type: NotificationTypes.SOS_ALERT
  }),

  rideRecommendation: (rideDetails, matchScore) => ({
    title: "Perfect Ride Match Found! ⭐",
    message: `We found a ${Math.round(matchScore * 100)}% match for your route to ${rideDetails.to}.`,
    type: NotificationTypes.RIDE_RECOMMENDATION
  }),

  seatAvailable: (rideDetails) => ({
    title: "Seat Available! 🎫",
    message: `A seat became available on the ride from ${rideDetails.from} to ${rideDetails.to} that you're interested in.`,
    type: NotificationTypes.SEAT_AVAILABLE
  }),

  locationShared: (userName) => ({
    title: "Location Shared 📍",
    message: `${userName} shared their live location with you in the chat.`,
    type: NotificationTypes.LOCATION_SHARED
  }),

  messageReceived: (userName) => ({
    title: "New Message 💬",
    message: `You have a new message from ${userName}.`,
    type: NotificationTypes.MESSAGE_RECEIVED
  }),

  weeklyStats: (stats) => ({
    title: "Your Weekly Travel Summary 📊",
    message: `This week: ${stats.ridesCompleted} rides, ${stats.carbonSaved}kg CO₂ saved, ₹${stats.moneySaved} saved!`,
    type: NotificationTypes.WEEKLY_STATS
  })
};

/**
 * Send templated notification
 */
async function sendTemplatedNotification(userId, templateName, data) {
  const template = NotificationTemplates[templateName];
  if (!template) {
    throw new Error(`Unknown notification template: ${templateName}`);
  }

  const { title, message, type } = template(data);
  return sendNotification(userId, title, message, type);
}

module.exports = {
  notificationQueue,
  NotificationTypes,
  NotificationTemplates,
  sendNotification,
  sendBatchNotifications,
  sendTemplatedNotification
};
