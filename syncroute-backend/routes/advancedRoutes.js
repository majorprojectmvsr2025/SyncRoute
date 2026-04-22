/**
 * Advanced System Features API Routes
 * 
 * Exposes endpoints for:
 * - Dynamic Pricing
 * - Demand Forecasting
 * - Fraud Detection
 * - Carbon Impact
 * - Search Caching
 * - Graph-based Matching
 */

const express = require("express");
const { protect, optionalAuth } = require("../middleware/auth");
const { calculateDynamicPrice, getSuggestedPriceRange, getDemandForecast, validatePrice } = require("../utils/dynamicPricing");
const { forecastDemand, getWeeklyPattern, getHourlyPattern, predictOptimalRideTimes } = require("../utils/demandForecasting");
const { calculateFraudRisk, quickFraudCheck, getHighRiskUsers } = require("../utils/fraudDetection");
const { calculateUserCarbonImpact, calculatePlatformCarbonImpact, getCarbonLeaderboard, getUserMonthlyCarbonStats, previewCarbonImpact } = require("../utils/carbonImpact");
const { getCache, invalidationHooks, getCacheStatsHandler } = require("../utils/searchCache");
const { findKBestMatches, calculateMultiObjectiveScore } = require("../utils/graphRideMatching");

const Ride = require("../models/Ride");

const router = express.Router();

// ========================
// DYNAMIC PRICING ENDPOINTS
// ========================

/**
 * GET /api/advanced/pricing/calculate
 * Calculate dynamic price for a route
 */
router.get("/pricing/calculate", async (req, res) => {
  try {
    const { distanceKm, vehicleType, departureTime, date, fromLat, fromLng, seats } = req.query;
    
    if (!distanceKm) {
      return res.status(400).json({ message: "distanceKm is required" });
    }
    
    const pricing = await calculateDynamicPrice({
      distanceKm: parseFloat(distanceKm),
      vehicleType,
      departureTime,
      date: date ? new Date(date) : new Date(),
      fromLocation: fromLat && fromLng ? { lat: parseFloat(fromLat), lng: parseFloat(fromLng) } : null,
      seats: parseInt(seats) || 1,
      includeDetailedBreakdown: true
    });
    
    res.json(pricing);
  } catch (error) {
    console.error("Pricing calculation error:", error);
    res.status(500).json({ message: "Failed to calculate pricing" });
  }
});

/**
 * GET /api/advanced/pricing/suggested
 * Get suggested price range for ride creation
 */
router.get("/pricing/suggested", protect, async (req, res) => {
  try {
    const { distanceKm, vehicleType, departureTime, date, fromLat, fromLng } = req.query;
    
    if (!distanceKm) {
      return res.status(400).json({ message: "distanceKm is required" });
    }
    
    const suggested = await getSuggestedPriceRange({
      distanceKm: parseFloat(distanceKm),
      vehicleType,
      departureTime,
      date: date ? new Date(date) : new Date(),
      fromLocation: fromLat && fromLng ? { lat: parseFloat(fromLat), lng: parseFloat(fromLng) } : null
    });
    
    res.json(suggested);
  } catch (error) {
    console.error("Suggested pricing error:", error);
    res.status(500).json({ message: "Failed to get suggested pricing" });
  }
});

/**
 * POST /api/advanced/pricing/validate
 * Validate driver's price against dynamic pricing
 */
router.post("/pricing/validate", protect, async (req, res) => {
  try {
    const { driverPrice, distanceKm, vehicleType, departureTime, date, fromLat, fromLng } = req.body;
    
    if (!driverPrice || !distanceKm) {
      return res.status(400).json({ message: "driverPrice and distanceKm are required" });
    }
    
    const validation = await validatePrice(driverPrice, {
      distanceKm: parseFloat(distanceKm),
      vehicleType,
      departureTime,
      date: date ? new Date(date) : new Date(),
      fromLocation: fromLat && fromLng ? { lat: parseFloat(fromLat), lng: parseFloat(fromLng) } : null
    });
    
    res.json(validation);
  } catch (error) {
    console.error("Price validation error:", error);
    res.status(500).json({ message: "Failed to validate price" });
  }
});

/**
 * GET /api/advanced/pricing/forecast
 * Get demand forecast for time slots
 */
router.get("/pricing/forecast", async (req, res) => {
  try {
    const { lat, lng, date } = req.query;
    
    const forecast = await getDemandForecast(
      lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      date ? new Date(date) : new Date()
    );
    
    res.json(forecast);
  } catch (error) {
    console.error("Demand forecast error:", error);
    res.status(500).json({ message: "Failed to get demand forecast" });
  }
});

// ========================
// DEMAND FORECASTING ENDPOINTS
// ========================

/**
 * GET /api/advanced/demand/forecast
 * Get demand forecast for a location and date
 */
router.get("/demand/forecast", async (req, res) => {
  try {
    const { lat, lng, date } = req.query;
    
    const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const targetDate = date ? new Date(date) : new Date();
    
    const forecast = await forecastDemand(location, targetDate);
    res.json(forecast);
  } catch (error) {
    console.error("Demand forecast error:", error);
    res.status(500).json({ message: "Failed to forecast demand" });
  }
});

/**
 * GET /api/advanced/demand/weekly
 * Get weekly demand pattern
 */
router.get("/demand/weekly", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    
    const pattern = await getWeeklyPattern(location);
    res.json(pattern);
  } catch (error) {
    console.error("Weekly pattern error:", error);
    res.status(500).json({ message: "Failed to get weekly pattern" });
  }
});

/**
 * GET /api/advanced/demand/hourly
 * Get hourly demand pattern
 */
router.get("/demand/hourly", async (req, res) => {
  try {
    const { lat, lng, dayOfWeek } = req.query;
    const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    
    const pattern = await getHourlyPattern(location, dayOfWeek ? parseInt(dayOfWeek) : null);
    res.json(pattern);
  } catch (error) {
    console.error("Hourly pattern error:", error);
    res.status(500).json({ message: "Failed to get hourly pattern" });
  }
});

/**
 * GET /api/advanced/demand/optimal-times
 * Predict optimal ride posting times
 */
router.get("/demand/optimal-times", protect, async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng, date } = req.query;
    
    if (!fromLat || !fromLng) {
      return res.status(400).json({ message: "Origin location required" });
    }
    
    const predictions = await predictOptimalRideTimes(
      { lat: parseFloat(fromLat), lng: parseFloat(fromLng) },
      toLat && toLng ? { lat: parseFloat(toLat), lng: parseFloat(toLng) } : null,
      date ? new Date(date) : new Date()
    );
    
    res.json(predictions);
  } catch (error) {
    console.error("Optimal times error:", error);
    res.status(500).json({ message: "Failed to predict optimal times" });
  }
});

// ========================
// FRAUD DETECTION ENDPOINTS
// ========================

/**
 * GET /api/advanced/fraud/check
 * Quick fraud check for current user
 */
router.get("/fraud/check", protect, async (req, res) => {
  try {
    const result = await quickFraudCheck(req.user._id);
    res.json(result);
  } catch (error) {
    console.error("Fraud check error:", error);
    res.status(500).json({ message: "Failed to perform fraud check" });
  }
});

/**
 * GET /api/advanced/fraud/analysis/:userId
 * Detailed fraud analysis (admin only)
 */
router.get("/fraud/analysis/:userId", protect, async (req, res) => {
  try {
    // TODO: Add admin check
    const analysis = await calculateFraudRisk(req.params.userId);
    res.json(analysis);
  } catch (error) {
    console.error("Fraud analysis error:", error);
    res.status(500).json({ message: "Failed to analyze fraud risk" });
  }
});

/**
 * GET /api/advanced/fraud/high-risk
 * Get high-risk users for admin review
 */
router.get("/fraud/high-risk", protect, async (req, res) => {
  try {
    // TODO: Add admin check
    const limit = parseInt(req.query.limit) || 20;
    const highRiskUsers = await getHighRiskUsers(limit);
    res.json({ users: highRiskUsers, count: highRiskUsers.length });
  } catch (error) {
    console.error("High-risk users error:", error);
    res.status(500).json({ message: "Failed to get high-risk users" });
  }
});

// ========================
// CARBON IMPACT ENDPOINTS
// ========================

/**
 * GET /api/advanced/carbon/my-impact
 * Get current user's carbon impact
 */
router.get("/carbon/my-impact", protect, async (req, res) => {
  try {
    const impact = await calculateUserCarbonImpact(req.user._id);
    res.json(impact);
  } catch (error) {
    console.error("Carbon impact error:", error);
    res.status(500).json({ message: "Failed to calculate carbon impact" });
  }
});

/**
 * GET /api/advanced/carbon/user/:userId
 * Get specific user's carbon impact
 */
router.get("/carbon/user/:userId", optionalAuth, async (req, res) => {
  try {
    const impact = await calculateUserCarbonImpact(req.params.userId);
    res.json(impact);
  } catch (error) {
    console.error("Carbon impact error:", error);
    res.status(500).json({ message: "Failed to calculate carbon impact" });
  }
});

/**
 * GET /api/advanced/carbon/platform
 * Get platform-wide carbon impact
 */
router.get("/carbon/platform", async (req, res) => {
  try {
    const impact = await calculatePlatformCarbonImpact();
    res.json(impact);
  } catch (error) {
    console.error("Platform carbon error:", error);
    res.status(500).json({ message: "Failed to calculate platform carbon impact" });
  }
});

/**
 * GET /api/advanced/carbon/leaderboard
 * Get carbon savings leaderboard
 */
router.get("/carbon/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await getCarbonLeaderboard(limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ message: "Failed to get leaderboard" });
  }
});

/**
 * GET /api/advanced/carbon/monthly
 * Get user's monthly carbon stats
 */
router.get("/carbon/monthly", protect, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const stats = await getUserMonthlyCarbonStats(req.user._id, months);
    res.json({ monthly: stats });
  } catch (error) {
    console.error("Monthly carbon error:", error);
    res.status(500).json({ message: "Failed to get monthly stats" });
  }
});

/**
 * GET /api/advanced/carbon/preview
 * Preview carbon impact for a ride
 */
router.get("/carbon/preview", async (req, res) => {
  try {
    const { distanceKm, passengers } = req.query;
    
    if (!distanceKm) {
      return res.status(400).json({ message: "distanceKm is required" });
    }
    
    const preview = previewCarbonImpact(
      parseFloat(distanceKm),
      parseInt(passengers) || 1
    );
    
    res.json(preview);
  } catch (error) {
    console.error("Carbon preview error:", error);
    res.status(500).json({ message: "Failed to preview carbon impact" });
  }
});

// ========================
// CACHE MANAGEMENT ENDPOINTS
// ========================

/**
 * GET /api/advanced/cache/stats
 * Get cache statistics
 */
router.get("/cache/stats", getCacheStatsHandler);

/**
 * POST /api/advanced/cache/clear
 * Clear all cache (admin only)
 */
router.post("/cache/clear", protect, async (req, res) => {
  try {
    // TODO: Add admin check
    const cleared = invalidationHooks.clearAll();
    res.json({ message: "Cache cleared", entriesCleared: cleared });
  } catch (error) {
    console.error("Cache clear error:", error);
    res.status(500).json({ message: "Failed to clear cache" });
  }
});

// ========================
// ADVANCED MATCHING ENDPOINTS
// ========================

/**
 * POST /api/advanced/match/search
 * Advanced graph-based ride matching
 */
router.post("/match/search", optionalAuth, async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, date, passengers, preferences, limit } = req.body;
    
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({ message: "Pickup and drop coordinates required" });
    }
    
    // Get available rides
    const query = {
      status: "active",
      availableSeats: { $gte: passengers || 1 }
    };
    
    if (date) {
      query.date = date;
    } else {
      query.date = { $gte: new Date().toISOString().split('T')[0] };
    }
    
    const rides = await Ride.find(query)
      .populate("driver", "name photo rating reliabilityScore driverVerification")
      .limit(100)
      .lean();
    
    // Apply graph-based matching
    const matches = findKBestMatches(
      rides,
      {
        pickupLat: parseFloat(pickupLat),
        pickupLng: parseFloat(pickupLng),
        dropLat: parseFloat(dropLat),
        dropLng: parseFloat(dropLng),
        seats: passengers || 1,
        preferences
      },
      preferences || {},
      parseInt(limit) || 10
    );
    
    res.json({
      matches,
      total: matches.length,
      algorithm: "graph-based-multi-objective"
    });
  } catch (error) {
    console.error("Advanced match error:", error);
    res.status(500).json({ message: "Failed to find matches" });
  }
});

/**
 * POST /api/advanced/match/score
 * Get matching score for a specific ride
 */
router.post("/match/score", optionalAuth, async (req, res) => {
  try {
    const { rideId, pickupLat, pickupLng, dropLat, dropLng, preferences } = req.body;
    
    if (!rideId || !pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({ message: "rideId and coordinates required" });
    }
    
    const ride = await Ride.findById(rideId)
      .populate("driver", "name photo rating reliabilityScore")
      .lean();
    
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    
    const score = calculateMultiObjectiveScore(
      ride,
      {
        pickupLat: parseFloat(pickupLat),
        pickupLng: parseFloat(pickupLng),
        dropLat: parseFloat(dropLat),
        dropLng: parseFloat(dropLng)
      },
      preferences || {}
    );
    
    res.json({ ride, score });
  } catch (error) {
    console.error("Match score error:", error);
    res.status(500).json({ message: "Failed to calculate match score" });
  }
});

module.exports = router;
