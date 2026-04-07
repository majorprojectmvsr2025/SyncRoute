#!/usr/bin/env node
/**
 * Quick import validation script
 * Checks if all required modules can be imported without errors
 */

console.log("Checking imports...\n");

try {
  console.log("✓ Checking core dependencies...");
  require("dotenv").config();
  require("http");
  require("express");
  require("helmet");
  require("morgan");
  require("express-rate-limit");
  require("cors");
  require("mongoose");
  require("socket.io");
  console.log("  ✓ All core dependencies loaded\n");
} catch (err) {
  console.error("✗ Core dependency error:", err.message);
  process.exit(1);
}

try {
  console.log("✓ Checking route imports...");
  require("./routes/authRoutes");
  require("./routes/googleAuthRoutes");
  require("./routes/rideRoutes");
  require("./routes/bookingRoutes");
  require("./routes/messageRoutes");
  require("./routes/statsRoutes");
  require("./routes/reviewRoutes");
  require("./routes/notificationRoutes");
  require("./routes/driverRoutes");
  require("./routes/documentRoutes");
  require("./routes/liveTrackingRoutes");
  require("./routes/sosRoutes");
  require("./routes/waitlistRoutes");
  require("./routes/prieRoutes");
  console.log("  ✓ All route files loaded\n");
} catch (err) {
  console.error("✗ Route import error:", err.message);
  console.error("  File:", err.stack?.split('\n')[1]);
  process.exit(1);
}

try {
  console.log("✓ Checking model imports...");
  require("./models/User");
  require("./models/Ride");
  require("./models/Booking");
  require("./models/Message");
  require("./models/Notification");
  require("./models/Review");
  require("./models/LiveTracking");
  require("./models/UserBehaviorAnalytics");
  require("./models/UserPreferenceProfile");
  require("./models/Waitlist");
  console.log("  ✓ All model files loaded\n");
} catch (err) {
  console.error("✗ Model import error:", err.message);
  console.error("  File:", err.stack?.split('\n')[1]);
  process.exit(1);
}

try {
  console.log("✓ Checking utility imports...");
  require("./utils/preferenceAnalyzer");
  require("./utils/personalizedScorer");
  require("./utils/smartNotifications");
  require("./utils/behaviorTracker");
  require("./utils/reliabilityCalculator");
  require("./utils/rideMatchUtils");
  require("./utils/routeDeviationDetector");
  require("./utils/documentValidationUtils");
  require("./utils/documentVerifier");
  require("./utils/nameMatchUtils");
  console.log("  ✓ All utility files loaded\n");
} catch (err) {
  console.error("✗ Utility import error:", err.message);
  console.error("  File:", err.stack?.split('\n')[1]);
  process.exit(1);
}

try {
  console.log("✓ Checking middleware imports...");
  require("./middleware/auth");
  console.log("  ✓ All middleware files loaded\n");
} catch (err) {
  console.error("✗ Middleware import error:", err.message);
  console.error("  File:", err.stack?.split('\n')[1]);
  process.exit(1);
}

try {
  console.log("✓ Checking socket handler...");
  require("./socket/socketHandler");
  console.log("  ✓ Socket handler loaded\n");
} catch (err) {
  console.error("✗ Socket handler error:", err.message);
  console.error("  File:", err.stack?.split('\n')[1]);
  process.exit(1);
}

console.log("✅ All imports validated successfully!");
console.log("Server can now start without import errors.\n");
process.exit(0);
