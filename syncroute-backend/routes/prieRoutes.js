const express = require("express");
const { protect } = require("../middleware/auth");
const { getUserPreferenceProfile, analyzeUserPreferences } = require("../utils/preferenceAnalyzer");
const { scoreAndRankRides, getPersonalizedSuggestions, RECOMMENDATION_THRESHOLD } = require("../utils/personalizedScorer");
const { trackSearch } = require("../utils/behaviorTracker");
const { runSmartNotificationChecks } = require("../utils/smartNotifications");
const UserBehaviorAnalytics = require("../models/UserBehaviorAnalytics");
const UserPreferenceProfile = require("../models/UserPreferenceProfile");
const Ride = require("../models/Ride");
const User = require("../models/User");
const Notification = require("../models/Notification");

const router = express.Router();

// Import ride matching utilities
const { closestRoutePoint } = require("../utils/rideMatchUtils");
const NEAR_ROUTE_M = 3000; // 3km threshold

/**
 * GET /api/prie/profile
 * Get user's preference profile
 */
router.get("/profile", protect, async (req, res) => {
  try {
    const profile = await getUserPreferenceProfile(req.user._id);
    
    if (!profile) {
      return res.json({
        hasProfile: false,
        message: "No preference profile yet. Book some rides to start building your profile!"
      });
    }

    res.json({
      hasProfile: true,
      profile: {
        timePreferences: profile.timePreferences,
        dayPreferences: profile.dayPreferences,
        driverPreferences: {
          genderPreference: profile.driverPreferences?.genderPreference,
          minRating: profile.driverPreferences?.minRating,
          reliabilitySensitivity: profile.driverPreferences?.reliabilitySensitivity
        },
        vehiclePreferences: {
          primary: profile.vehiclePreferences?.primary,
          distribution: {
            sedan: profile.vehiclePreferences?.sedan,
            suv: profile.vehiclePreferences?.suv,
            compact: profile.vehiclePreferences?.compact,
            van: profile.vehiclePreferences?.van
          }
        },
        pricePreferences: profile.pricePreferences,
        distancePreferences: profile.distancePreferences,
        comfortPreferences: {
          musicPrimary: profile.comfortPreferences?.musicPrimary,
          conversationPrimary: profile.comfortPreferences?.conversationPrimary,
          smokingTolerance: profile.comfortPreferences?.smokingTolerance
        },
        bookingStyle: {
          instantBookingPreference: profile.bookingStyle?.instantBookingPreference,
          lastMinuteBooker: profile.bookingStyle?.lastMinuteBooker,
          advancePlanner: profile.bookingStyle?.advancePlanner
        },
        routeClusters: profile.routeClusters?.map(c => ({
          label: c.label,
          frequency: c.frequency,
          typicalDepartureHour: c.typicalDepartureHour
        })),
        metadata: {
          totalBookings: profile.metadata?.totalBookings,
          totalSearches: profile.metadata?.totalSearches,
          overallConfidence: profile.metadata?.overallConfidence,
          isActive: profile.metadata?.isActive,
          lastAnalyzedAt: profile.metadata?.lastAnalyzedAt
        }
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Failed to get preference profile" });
  }
});

/**
 * POST /api/prie/profile/refresh
 * Force refresh of preference profile
 */
router.post("/profile/refresh", protect, async (req, res) => {
  try {
    const profile = await analyzeUserPreferences(req.user._id, true);
    
    res.json({
      message: "Profile refreshed successfully",
      metadata: profile.metadata
    });
  } catch (error) {
    console.error("Refresh profile error:", error);
    res.status(500).json({ message: "Failed to refresh profile" });
  }
});

/**
 * POST /api/prie/search
 * Personalized ride search with ML-based ranking
 */
router.post("/search", protect, async (req, res) => {
  try {
    const {
      pickupLat, pickupLng, dropLat, dropLng,
      date, passengers = 1, filters = {}
    } = req.body;

    // Validate required fields
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({ message: "Pickup and drop coordinates required" });
    }

    // Build base query (similar to regular search)
    // FIXED: Include both "scheduled" and "active" rides
    const query = {
      status: { $in: ["scheduled", "active"] },
      availableSeats: { $gte: passengers }
    };

    // Date filter - use string-based comparison since dates are stored as strings
    const today = new Date().toISOString().split("T")[0];
    if (date) {
      query.date = date;  // Exact match for specified date
    } else {
      query.date = { $gte: today };  // Future dates only
    }

    // Get rides with populated driver
    const rides = await Ride.find(query)
      .populate("driver", "name photo rating trips gender driverVerification reliabilityScore")
      .sort({ date: 1, departureTime: 1 })
      .limit(100)
      .lean();

    // Apply route matching (from existing search logic)
    const matchedRides = [];
    
    console.log(`[PRIE SEARCH] Query returned ${rides.length} rides. Checking route matches...`);
    
    for (const ride of rides) {
      const coords = ride.routePath?.coordinates;
      
      if (coords && coords.length > 1) {
        // Route-based matching
        const pickupPoint = closestRoutePoint(coords, pickupLat, pickupLng);
        const dropPoint = closestRoutePoint(coords, dropLat, dropLng);

        console.log(`  ${ride.from?.name}->${ride.to?.name}: pickup=${Math.round(pickupPoint.dist)}m@${pickupPoint.idx}, drop=${Math.round(dropPoint.dist)}m@${dropPoint.idx}`);

        if (pickupPoint.dist <= NEAR_ROUTE_M && dropPoint.dist <= NEAR_ROUTE_M) {
          // Allow equal indices (pickup.idx <= drop.idx) for adjacent/same points
          if (pickupPoint.idx <= dropPoint.idx) {
            ride.pickupDistanceMeters = Math.round(pickupPoint.dist);
            ride.dropDistanceMeters = Math.round(dropPoint.dist);
            ride.overlapDistanceMeters = (dropPoint.idx - pickupPoint.idx) * 100;
            matchedRides.push(ride);
            console.log(`    [MATCH]`);
          } else {
            console.log(`    [SKIP] Wrong direction`);
          }
        } else {
          console.log(`    [SKIP] Too far from route (max ${NEAR_ROUTE_M}m)`);
        }
      } else {
        // Fallback: direct distance matching
        const haversine = (lat1, lon1, lat2, lon2) => {
          const R = 6371000;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        const fromDist = haversine(pickupLat, pickupLng, ride.from?.location?.coordinates?.[1], ride.from?.location?.coordinates?.[0]);
        const toDist = haversine(dropLat, dropLng, ride.to?.location?.coordinates?.[1], ride.to?.location?.coordinates?.[0]);

        console.log(`  ${ride.from?.name}->${ride.to?.name}: No route. Fallback: pickup=${Math.round(fromDist)}m, drop=${Math.round(toDist)}m`);

        if (fromDist <= 50000 && toDist <= 50000) {
          ride.pickupDistanceMeters = Math.round(fromDist);
          ride.dropDistanceMeters = Math.round(toDist);
          matchedRides.push(ride);
          console.log(`    [MATCH]`);
        } else {
          console.log(`    [SKIP] Too far from endpoints`);
        }
      }
    }

    console.log(`[PRIE SEARCH] Matched ${matchedRides.length}/${rides.length} rides`);

    // Apply personalized scoring and ranking
    const searchCoords = { pickupLat, pickupLng, dropLat, dropLng };
    const personalizedRides = await scoreAndRankRides(matchedRides, req.user._id, searchCoords);

    // Track search behavior (async, don't await)
    trackSearch(req.user._id, {
      pickupLat, pickupLng, dropLat, dropLng,
      date, passengers,
      fromName: req.body.fromName,
      toName: req.body.toName
    }, personalizedRides.length, filters);

    // Separate recommended and other rides
    const recommended = personalizedRides.filter(r => r.personalization?.isRecommended);
    const others = personalizedRides.filter(r => !r.personalization?.isRecommended);

    res.json({
      rides: personalizedRides,
      meta: {
        total: personalizedRides.length,
        recommended: recommended.length,
        isPersonalized: personalizedRides.some(r => r.personalization?.isPersonalized)
      }
    });
  } catch (error) {
    console.error("Personalized search error:", error);
    res.status(500).json({ message: "Search failed" });
  }
});

/**
 * GET /api/prie/suggestions
 * Get personalized ride suggestions
 */
router.get("/suggestions", protect, async (req, res) => {
  try {
    const suggestions = await getPersonalizedSuggestions(req.user._id);
    res.json(suggestions);
  } catch (error) {
    console.error("Get suggestions error:", error);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
});

/**
 * GET /api/prie/insights
 * Get user's travel insights for dashboard
 */
router.get("/insights", protect, async (req, res) => {
  try {
    const profile = await getUserPreferenceProfile(req.user._id);
    
    if (!profile || !profile.metadata?.isActive) {
      return res.json({
        hasInsights: false,
        message: "Complete a few more rides to unlock travel insights!"
      });
    }

    const insights = [];

    // Time insight
    if (profile.timePreferences?.confidence > 0.3) {
      const slots = ["morning", "afternoon", "evening", "night"];
      const topSlot = slots.reduce((a, b) => 
        (profile.timePreferences[a] || 0) > (profile.timePreferences[b] || 0) ? a : b
      );
      const percentage = Math.round((profile.timePreferences[topSlot] || 0) * 100);
      
      if (percentage > 35) {
        insights.push({
          type: "time",
          icon: "clock",
          title: `${topSlot.charAt(0).toUpperCase() + topSlot.slice(1)} Traveler`,
          description: `${percentage}% of your rides are in the ${topSlot}`
        });
      }
    }

    // Route insight
    if (profile.routeClusters?.length > 0) {
      const topRoute = profile.routeClusters[0];
      insights.push({
        type: "route",
        icon: "map-pin",
        title: "Frequent Route",
        description: `${topRoute.label} - ${topRoute.frequency} trips`
      });
    }

    // Vehicle insight
    if (profile.vehiclePreferences?.primary) {
      insights.push({
        type: "vehicle",
        icon: "car",
        title: "Preferred Vehicle",
        description: `You usually book ${profile.vehiclePreferences.primary} rides`
      });
    }

    // Price insight
    if (profile.pricePreferences?.confidence > 0.3) {
      insights.push({
        type: "price",
        icon: "indian-rupee",
        title: "Average Fare",
        description: `₹${profile.pricePreferences.avgPrice} per ride`
      });
    }

    // Booking style insight
    if (profile.bookingStyle?.lastMinuteBooker) {
      insights.push({
        type: "booking",
        icon: "zap",
        title: "Last-Minute Booker",
        description: "You often book rides close to departure time"
      });
    } else if (profile.bookingStyle?.advancePlanner) {
      insights.push({
        type: "booking",
        icon: "calendar",
        title: "Advance Planner",
        description: "You typically book rides well in advance"
      });
    }

    res.json({
      hasInsights: insights.length > 0,
      insights: insights.slice(0, 5),
      confidence: profile.metadata.overallConfidence
    });
  } catch (error) {
    console.error("Get insights error:", error);
    res.status(500).json({ message: "Failed to get insights" });
  }
});

/**
 * POST /api/prie/smart-notify
 * Check and send smart notifications
 */
router.post("/smart-notify", protect, async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await runSmartNotificationChecks(req.user._id, io);
    res.json(result);
  } catch (error) {
    console.error("Smart notify error:", error);
    res.status(500).json({ message: "Failed to check notifications" });
  }
});

/**
 * GET /api/prie/analytics
 * Get user's behavior analytics (for debugging/transparency)
 */
router.get("/analytics", protect, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analytics = await UserBehaviorAnalytics.aggregate([
      {
        $match: {
          userId: req.user._id,
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
          lastEvent: { $max: "$timestamp" }
        }
      }
    ]);

    const summary = analytics.reduce((acc, item) => {
      acc[item._id] = { count: item.count, lastEvent: item.lastEvent };
      return acc;
    }, {});

    res.json({
      period: "Last 30 days",
      events: summary,
      totalEvents: Object.values(summary).reduce((a, b) => a + b.count, 0)
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ message: "Failed to get analytics" });
  }
});

/**
 * DELETE /api/prie/data
 * Delete user's personalization data (GDPR compliance)
 */
router.delete("/data", protect, async (req, res) => {
  try {
    await Promise.all([
      UserBehaviorAnalytics.deleteMany({ userId: req.user._id }),
      UserPreferenceProfile.deleteOne({ userId: req.user._id })
    ]);

    res.json({ message: "Personalization data deleted successfully" });
  } catch (error) {
    console.error("Delete data error:", error);
    res.status(500).json({ message: "Failed to delete data" });
  }
});

module.exports = router;
