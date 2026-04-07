/**
 * Firebase Cloud Messaging Integration
 * Provides push notification capabilities for the SyncRoute platform
 * 
 * This module integrates with the existing notification system
 * without modifying the core notification logic.
 */

// Dynamic import with graceful fallback
let admin = null;
let firebaseApp = null;
let messaging = null;

try {
  admin = require('firebase-admin');
} catch (err) {
  console.log('[FCM] Firebase Admin SDK not installed - push notifications disabled');
}

function initializeFirebase() {
  if (!admin) return false;
  if (firebaseApp) return true;

  try {
    // Check for Firebase credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!serviceAccount && !projectId) {
      console.log('[FCM] Firebase not configured - push notifications disabled');
      return false;
    }

    if (serviceAccount) {
      // Initialize with service account JSON
      const credentials = JSON.parse(serviceAccount);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId: credentials.project_id
      });
    } else if (projectId) {
      // Initialize with default credentials (for cloud environments)
      firebaseApp = admin.initializeApp({
        projectId: projectId
      });
    }

    messaging = admin.messaging();
    console.log('[FCM] Firebase Cloud Messaging initialized');
    return true;
  } catch (error) {
    console.error('[FCM] Firebase initialization failed:', error.message);
    return false;
  }
}

// Initialize on module load
initializeFirebase();

/**
 * Send push notification to a single device
 * @param {string} fcmToken - Device FCM token
 * @param {Object} notification - Notification payload
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {Object} data - Additional data payload
 */
async function sendPushNotification(fcmToken, notification, data = {}) {
  if (!messaging) {
    console.log('[FCM] Push notification skipped - Firebase not configured');
    return { success: false, reason: 'not_configured' };
  }

  if (!fcmToken) {
    return { success: false, reason: 'no_token' };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      data: {
        ...data,
        clickAction: data.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          channelId: data.channelId || 'syncroute_default',
          sound: 'default',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: data.badge || 1
          }
        }
      },
      webpush: {
        notification: {
          icon: '/logo192.png',
          badge: '/logo192.png',
          requireInteraction: data.requireInteraction || false
        },
        fcmOptions: {
          link: data.url || '/'
        }
      }
    };

    const response = await messaging.send(message);
    console.log(`[FCM] Push notification sent: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('[FCM] Send error:', error.message);
    
    // Handle invalid token
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, reason: 'invalid_token', shouldRemove: true };
    }
    
    return { success: false, reason: error.message };
  }
}

/**
 * Send push notification to multiple devices
 * @param {string[]} fcmTokens - Array of device FCM tokens
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload
 */
async function sendMulticastPush(fcmTokens, notification, data = {}) {
  if (!messaging) {
    return { success: false, reason: 'not_configured' };
  }

  if (!fcmTokens || fcmTokens.length === 0) {
    return { success: false, reason: 'no_tokens' };
  }

  // Filter out invalid tokens
  const validTokens = fcmTokens.filter(t => t && typeof t === 'string');
  if (validTokens.length === 0) {
    return { success: false, reason: 'no_valid_tokens' };
  }

  try {
    const message = {
      tokens: validTokens,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high'
      }
    };

    const response = await messaging.sendEachForMulticast(message);
    
    // Collect failed tokens for removal
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code?.includes('registration-token')) {
        failedTokens.push(validTokens[idx]);
      }
    });

    console.log(`[FCM] Multicast: ${response.successCount} success, ${response.failureCount} failed`);
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens
    };
  } catch (error) {
    console.error('[FCM] Multicast error:', error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Send topic notification (for broadcast messages)
 * @param {string} topic - Topic name
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload
 */
async function sendTopicNotification(topic, notification, data = {}) {
  if (!messaging) {
    return { success: false, reason: 'not_configured' };
  }

  try {
    const message = {
      topic: topic,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    };

    const response = await messaging.send(message);
    console.log(`[FCM] Topic notification sent to ${topic}: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('[FCM] Topic send error:', error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Subscribe device to topic
 */
async function subscribeToTopic(fcmToken, topic) {
  if (!messaging) return false;
  
  try {
    await messaging.subscribeToTopic([fcmToken], topic);
    return true;
  } catch (error) {
    console.error('[FCM] Subscribe error:', error.message);
    return false;
  }
}

/**
 * Unsubscribe device from topic
 */
async function unsubscribeFromTopic(fcmToken, topic) {
  if (!messaging) return false;
  
  try {
    await messaging.unsubscribeFromTopic([fcmToken], topic);
    return true;
  } catch (error) {
    console.error('[FCM] Unsubscribe error:', error.message);
    return false;
  }
}

// Notification type templates for SyncRoute
const NOTIFICATION_TEMPLATES = {
  RIDE_REMINDER: (rideName, time) => ({
    title: '🚗 Ride Reminder',
    body: `Your ride "${rideName}" starts in ${time}`,
    data: { type: 'ride_reminder', channelId: 'ride_alerts' }
  }),
  
  RIDE_STARTED: (driverName) => ({
    title: '🚗 Ride Started!',
    body: `${driverName} has started the ride. Track your journey now.`,
    data: { type: 'ride_started', channelId: 'ride_alerts' }
  }),
  
  NEW_MESSAGE: (senderName) => ({
    title: '💬 New Message',
    body: `${senderName} sent you a message`,
    data: { type: 'new_message', channelId: 'chat' }
  }),
  
  BOOKING_CONFIRMED: (rideName) => ({
    title: '✅ Booking Confirmed',
    body: `Your booking for "${rideName}" has been confirmed!`,
    data: { type: 'booking_confirmed', channelId: 'bookings' }
  }),
  
  SOS_ALERT: (userName, location) => ({
    title: '🆘 SOS EMERGENCY ALERT',
    body: `${userName} needs help! Location: ${location}`,
    data: { type: 'sos_alert', channelId: 'sos', requireInteraction: true }
  }),
  
  WAITLIST_OFFER: (rideName) => ({
    title: '🎉 Seat Available!',
    body: `A seat is now available for "${rideName}". Book now!`,
    data: { type: 'waitlist_offer', channelId: 'ride_alerts' }
  })
};

/**
 * Check if Firebase is configured
 */
function isFirebaseConfigured() {
  return messaging !== null;
}

/**
 * Get FCM status info
 */
function getFCMInfo() {
  return {
    configured: isFirebaseConfigured(),
    projectId: firebaseApp?.options?.projectId || null
  };
}

module.exports = {
  sendPushNotification,
  sendMulticastPush,
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  isFirebaseConfigured,
  getFCMInfo,
  NOTIFICATION_TEMPLATES
};
