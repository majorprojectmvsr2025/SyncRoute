const express = require("express");
const LiveTracking = require("../models/LiveTracking");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { protect, optionalAuth } = require("../middleware/auth");
const { 
  checkDeviation, 
  calculateRemainingDistance, 
  estimateRemainingTime,
  calculateRouteProgress,
  hasArrivedAtDestination
} = require("../utils/routeDeviationDetector");

const router = express.Router();

/**
 * Start live location sharing
 * POST /api/live-tracking/start
 */
router.post("/start", protect, async (req, res) => {
  try {
    const { rideId, bookingId, initialLocation } = req.body;
    
    // Verify ride exists and user is participant
    const ride = await Ride.findById(rideId).populate("driver");
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    
    const isDriver = ride.driver._id.toString() === req.user._id.toString();
    let booking = null;
    
    if (!isDriver) {
      // Verify user has a booking for this ride
      booking = await Booking.findOne({
        ride: rideId,
        passenger: req.user._id,
        status: { $in: ["confirmed", "pending"] }
      });
      
      if (!booking) {
        return res.status(403).json({ message: "You are not a participant in this ride" });
      }
    }
    
    // Check if ride is ongoing
    if (ride.status !== "in-progress") {
      return res.status(400).json({ message: "Ride must be ongoing to share live location" });
    }
    
    // Check for existing active tracking session
    const existingSession = await LiveTracking.findOne({
      ride: rideId,
      sharedBy: req.user._id,
      status: "active"
    });
    
    if (existingSession) {
      return res.status(400).json({ 
        message: "You already have an active tracking session",
        trackingToken: existingSession.trackingToken
      });
    }
    
    // Generate tracking token and expiry (24 hours or ride day end)
    const token = LiveTracking.generateToken();
    const rideDate = new Date(ride.date);
    const endOfRideDay = new Date(rideDate);
    endOfRideDay.setHours(23, 59, 59, 999);
    const expiresAt = endOfRideDay < new Date(Date.now() + 24 * 60 * 60 * 1000) 
      ? endOfRideDay 
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Create tracking session
    const tracking = await LiveTracking.create({
      sharedBy: req.user._id,
      ride: rideId,
      booking: booking?._id,
      trackingToken: token,
      currentLocation: initialLocation ? {
        type: "Point",
        coordinates: [initialLocation.lng, initialLocation.lat]
      } : undefined,
      expiresAt,
      plannedRoute: ride.routePath
    });
    
    // Add to ride's active tracking sessions
    await Ride.findByIdAndUpdate(rideId, {
      $addToSet: { activeTrackingSessions: tracking._id }
    });
    
    // Generate shareable link
    const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/track/${token}`;
    
    res.status(201).json({
      trackingToken: token,
      trackingUrl,
      expiresAt,
      sessionId: tracking._id
    });
  } catch (error) {
    console.error("Start tracking error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Location update throttle configuration
 */
const THROTTLE_CONFIG = {
  minUpdateInterval: 5000, // Minimum 5 seconds between updates
  batchWindowMs: 2000,     // Batch updates within 2 seconds
  maxAccuracyThreshold: 100 // Ignore updates with accuracy > 100m
};

// In-memory throttle cache
const updateThrottle = new Map(); // trackingToken -> lastUpdateTime

/**
 * Update location (GPS update) with throttling
 * POST /api/live-tracking/update
 */
router.post("/update", protect, async (req, res) => {
  try {
    const { trackingToken, lat, lng, accuracy, speed, heading } = req.body;
    
    // Accuracy filter - ignore very inaccurate readings
    if (accuracy && accuracy > THROTTLE_CONFIG.maxAccuracyThreshold) {
      return res.json({ 
        updated: false, 
        reason: "accuracy_too_low",
        message: "Location accuracy too low, waiting for better signal"
      });
    }
    
    // Throttle check
    const now = Date.now();
    const lastUpdate = updateThrottle.get(trackingToken) || 0;
    const timeSinceLastUpdate = now - lastUpdate;
    
    if (timeSinceLastUpdate < THROTTLE_CONFIG.minUpdateInterval) {
      return res.json({ 
        updated: false, 
        reason: "throttled",
        nextUpdateIn: THROTTLE_CONFIG.minUpdateInterval - timeSinceLastUpdate
      });
    }
    
    // Update throttle timestamp
    updateThrottle.set(trackingToken, now);
    
    const tracking = await LiveTracking.findOne({
      trackingToken,
      sharedBy: req.user._id,
      status: "active"
    }).populate("ride");
    
    if (!tracking) {
      updateThrottle.delete(trackingToken); // Clean up
      return res.status(404).json({ message: "Active tracking session not found" });
    }
    
    if (!tracking.isValid()) {
      tracking.status = "expired";
      await tracking.save();
      updateThrottle.delete(trackingToken);
      return res.status(400).json({ message: "Tracking session has expired" });
    }
    
    // Update location
    tracking.updateLocation({ lat, lng }, { accuracy, speed, heading });
    
    // Check for route deviation
    const routeCoords = tracking.ride?.routePath?.coordinates;
    let deviationResult = null;
    
    if (routeCoords && routeCoords.length > 0) {
      deviationResult = checkDeviation({
        currentLat: lat,
        currentLng: lng,
        routeCoords,
        previousDeviationCount: tracking.deviationCount,
        lastDeviationAlert: tracking.lastDeviationAlert
      });
      
      tracking.deviationDetected = deviationResult.isDeviated;
      tracking.deviationCount = deviationResult.newDeviationCount;
      
      if (deviationResult.shouldAlert) {
        tracking.lastDeviationAlert = new Date();
        
        // Emit deviation alert via socket if available
        const io = req.app.get("io");
        if (io) {
          // Alert ride passengers
          const bookings = await Booking.find({
            ride: tracking.ride._id,
            status: { $in: ["confirmed", "pending"] }
          });
          
          for (const booking of bookings) {
            io.to(`user:${booking.passenger}`).emit("route_deviation", {
              rideId: tracking.ride._id,
              message: deviationResult.message,
              currentLocation: { lat, lng },
              distance: deviationResult.distance
            });
          }
        }
      }
      
      // Calculate ETA
      const remainingDistance = calculateRemainingDistance(routeCoords, lat, lng);
      const remainingTime = estimateRemainingTime(remainingDistance, speed);
      
      tracking.eta = {
        destination: tracking.ride.to?.name || "Destination",
        estimatedArrival: new Date(Date.now() + remainingTime * 1000),
        distanceRemaining: remainingDistance,
        durationRemaining: remainingTime
      };
      
      // Check if arrived
      if (hasArrivedAtDestination(routeCoords, lat, lng)) {
        tracking.status = "stopped";
        tracking.stoppedAt = new Date();
      }
    }
    
    await tracking.save();
    
    res.json({
      updated: true,
      eta: tracking.eta,
      deviation: deviationResult ? {
        isDeviated: deviationResult.isDeviated,
        distance: deviationResult.distance,
        alertSent: deviationResult.shouldAlert
      } : null
    });
  } catch (error) {
    console.error("Update tracking error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stop live location sharing
 * POST /api/live-tracking/stop
 */
router.post("/stop", protect, async (req, res) => {
  try {
    const { trackingToken } = req.body;
    
    const tracking = await LiveTracking.findOne({
      trackingToken,
      sharedBy: req.user._id,
      status: "active"
    });
    
    if (!tracking) {
      return res.status(404).json({ message: "Active tracking session not found" });
    }
    
    tracking.stopTracking();
    await tracking.save();
    
    // Remove from ride's active sessions
    await Ride.findByIdAndUpdate(tracking.ride, {
      $pull: { activeTrackingSessions: tracking._id }
    });
    
    res.json({ message: "Tracking stopped successfully" });
  } catch (error) {
    console.error("Stop tracking error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get tracking status for user's active sessions
 * GET /api/live-tracking/my-sessions
 */
router.get("/my-sessions", protect, async (req, res) => {
  try {
    const sessions = await LiveTracking.find({
      sharedBy: req.user._id,
      status: "active"
    })
      .populate("ride", "from to date departureTime status")
      .sort({ startedAt: -1 });
    
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Public tracking page data (no auth required)
 * GET /api/live-tracking/public/:token
 */
router.get("/public/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    const tracking = await LiveTracking.findOne({
      trackingToken: token
    })
      .populate({
        path: "ride",
        select: "from to date departureTime status routePath driver vehicleType vehicleModel",
        populate: {
          path: "driver",
          select: "name photo vehicle"
        }
      })
      .populate("sharedBy", "name photo");
    
    if (!tracking) {
      return res.status(404).json({ message: "Tracking link not found" });
    }
    
    // Check if expired
    if (tracking.status === "expired" || tracking.expiresAt < new Date()) {
      return res.status(410).json({ message: "Tracking link has expired" });
    }
    
    if (tracking.status === "stopped") {
      return res.status(410).json({ message: "Location sharing has been stopped" });
    }
    
    // Calculate progress
    const routeCoords = tracking.ride?.routePath?.coordinates;
    let progress = 0;
    
    if (routeCoords && tracking.currentLocation?.coordinates) {
      const [lng, lat] = tracking.currentLocation.coordinates;
      progress = calculateRouteProgress(routeCoords, lat, lng);
    }
    
    res.json({
      currentLocation: tracking.currentLocation,
      eta: tracking.eta,
      progress,
      ride: {
        from: tracking.ride.from,
        to: tracking.ride.to,
        date: tracking.ride.date,
        departureTime: tracking.ride.departureTime,
        vehicleType: tracking.ride.vehicleType,
        vehicleModel: tracking.ride.vehicleModel,
        driver: tracking.ride.driver
      },
      sharedBy: tracking.sharedBy,
      startedAt: tracking.startedAt,
      lastUpdatedAt: tracking.lastUpdatedAt,
      routePath: tracking.ride.routePath
    });
  } catch (error) {
    console.error("Public tracking error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stop all tracking sessions for a ride (called when ride completes/cancels)
 * POST /api/live-tracking/stop-ride-sessions
 */
router.post("/stop-ride-sessions", protect, async (req, res) => {
  try {
    const { rideId } = req.body;
    
    // Verify user is driver of the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // Stop all active sessions
    const result = await LiveTracking.updateMany(
      { ride: rideId, status: "active" },
      { status: "stopped", stoppedAt: new Date() }
    );
    
    // Clear ride's active sessions
    await Ride.findByIdAndUpdate(rideId, {
      activeTrackingSessions: []
    });
    
    res.json({ 
      message: "All tracking sessions stopped",
      sessionsUpdated: result.modifiedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
