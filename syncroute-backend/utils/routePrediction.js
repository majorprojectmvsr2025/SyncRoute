/**
 * Route Prediction System
 * 
 * Uses behavioral patterns to predict user's next ride:
 * - Time-based patterns (daily commute times)
 * - Day-of-week patterns (work days vs weekends)
 * - Route clustering (frequent routes)
 * - Contextual predictions (based on current time/day)
 */

const UserBehaviorAnalytics = require("../models/UserBehaviorAnalytics");
const UserPreferenceProfile = require("../models/UserPreferenceProfile");
const Ride = require("../models/Ride");

// Prediction configuration
const PREDICTION_CONFIG = {
  minDataPoints: 5, // Minimum rides to make predictions
  confidenceThreshold: 0.6, // Minimum confidence to show prediction
  routeClusterRadius: 2, // km radius for route clustering
  timeWindowMinutes: 60, // Time window for matching
  lookbackDays: 90, // Days of data to analyze
  maxPredictions: 3 // Max predictions to return
};

/**
 * Main prediction function
 * @param {string} userId - User ID
 * @param {Date} targetDate - Date to predict for (default: today/tomorrow)
 * @returns {Object} Prediction results
 */
async function predictNextRide(userId, targetDate = null) {
  try {
    // Get user's behavioral data
    const behaviorData = await getUserBehaviorData(userId);
    
    if (behaviorData.totalRides < PREDICTION_CONFIG.minDataPoints) {
      return {
        hasPrediction: false,
        reason: "insufficient_data",
        message: "Complete more rides to get personalized predictions",
        ridesNeeded: PREDICTION_CONFIG.minDataPoints - behaviorData.totalRides
      };
    }

    // Determine target datetime
    const now = new Date();
    const target = targetDate || getNextPredictionTarget(now, behaviorData);
    const targetDay = target.getDay(); // 0=Sun, 6=Sat
    const targetHour = target.getHours();

    // Generate predictions
    const predictions = [];

    // 1. Time-based route prediction
    const timePrediction = predictByTimePattern(behaviorData, targetDay, targetHour);
    if (timePrediction) predictions.push(timePrediction);

    // 2. Day-of-week pattern prediction
    const dayPrediction = predictByDayPattern(behaviorData, targetDay);
    if (dayPrediction && !isDuplicatePrediction(predictions, dayPrediction)) {
      predictions.push(dayPrediction);
    }

    // 3. Route cluster prediction (most frequent routes)
    const clusterPredictions = predictByRouteClusters(behaviorData, target);
    for (const pred of clusterPredictions) {
      if (!isDuplicatePrediction(predictions, pred)) {
        predictions.push(pred);
      }
    }

    // Sort by confidence and limit
    predictions.sort((a, b) => b.confidence - a.confidence);
    const topPredictions = predictions.slice(0, PREDICTION_CONFIG.maxPredictions);

    // Find matching available rides
    const enrichedPredictions = await enrichWithAvailableRides(topPredictions, target);

    return {
      hasPrediction: enrichedPredictions.length > 0,
      targetDate: target,
      predictions: enrichedPredictions,
      dataQuality: {
        totalRides: behaviorData.totalRides,
        analyzedDays: behaviorData.analyzedDays,
        confidence: calculateOverallConfidence(enrichedPredictions)
      }
    };
  } catch (error) {
    console.error("Route prediction error:", error);
    return {
      hasPrediction: false,
      reason: "error",
      message: "Unable to generate predictions"
    };
  }
}

/**
 * Get user's behavioral data for analysis
 */
async function getUserBehaviorData(userId) {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - PREDICTION_CONFIG.lookbackDays);

  // Get booking events
  const bookingEvents = await UserBehaviorAnalytics.find({
    userId,
    eventType: { $in: ["booking_completed", "booking_created"] },
    timestamp: { $gte: lookbackDate }
  }).sort({ timestamp: -1 });

  // Get preference profile
  const profile = await UserPreferenceProfile.findOne({ userId });

  // Analyze patterns
  const timePatterns = analyzeTimePatterns(bookingEvents);
  const dayPatterns = analyzeDayPatterns(bookingEvents);
  const routeClusters = analyzeRouteClusters(bookingEvents);

  return {
    totalRides: bookingEvents.length,
    analyzedDays: PREDICTION_CONFIG.lookbackDays,
    timePatterns,
    dayPatterns,
    routeClusters,
    profile,
    recentRoutes: extractRecentRoutes(bookingEvents)
  };
}

/**
 * Analyze time-of-day patterns
 */
function analyzeTimePatterns(events) {
  const patterns = {};
  
  // Group by hour and day
  for (const event of events) {
    const date = new Date(event.timestamp);
    const day = date.getDay();
    const hour = date.getHours();
    const key = `${day}-${hour}`;

    if (!patterns[key]) {
      patterns[key] = {
        day,
        hour,
        count: 0,
        routes: []
      };
    }

    patterns[key].count++;
    
    if (event.metadata?.from && event.metadata?.to) {
      patterns[key].routes.push({
        from: event.metadata.from,
        to: event.metadata.to
      });
    }
  }

  // Convert to array and calculate probabilities
  const totalEvents = events.length;
  return Object.values(patterns).map(p => ({
    ...p,
    probability: p.count / totalEvents,
    topRoute: getMostFrequentRoute(p.routes)
  }));
}

/**
 * Analyze day-of-week patterns
 */
function analyzeDayPatterns(events) {
  const dayStats = Array(7).fill(null).map(() => ({
    count: 0,
    routes: [],
    avgHour: 0,
    hours: []
  }));

  for (const event of events) {
    const date = new Date(event.timestamp);
    const day = date.getDay();
    const hour = date.getHours();

    dayStats[day].count++;
    dayStats[day].hours.push(hour);

    if (event.metadata?.from && event.metadata?.to) {
      dayStats[day].routes.push({
        from: event.metadata.from,
        to: event.metadata.to
      });
    }
  }

  // Calculate averages
  return dayStats.map((stat, day) => {
    if (stat.count === 0) return { day, active: false };

    return {
      day,
      active: true,
      count: stat.count,
      avgHour: Math.round(stat.hours.reduce((a, b) => a + b, 0) / stat.hours.length),
      peakHours: findPeakHours(stat.hours),
      topRoute: getMostFrequentRoute(stat.routes),
      probability: stat.count / events.length
    };
  });
}

/**
 * Cluster frequent routes
 */
function analyzeRouteClusters(events) {
  const routeMap = new Map();

  for (const event of events) {
    if (!event.metadata?.from || !event.metadata?.to) continue;

    const fromCoords = event.metadata.from.coordinates;
    const toCoords = event.metadata.to.coordinates;
    
    if (!fromCoords || !toCoords) continue;

    // Create route key (rounded coordinates for clustering)
    const key = `${roundCoord(fromCoords[0])},${roundCoord(fromCoords[1])}-${roundCoord(toCoords[0])},${roundCoord(toCoords[1])}`;

    if (!routeMap.has(key)) {
      routeMap.set(key, {
        from: event.metadata.from,
        to: event.metadata.to,
        count: 0,
        times: [],
        days: []
      });
    }

    const route = routeMap.get(key);
    route.count++;
    route.times.push(new Date(event.timestamp).getHours());
    route.days.push(new Date(event.timestamp).getDay());
  }

  // Convert to array and sort by frequency
  return Array.from(routeMap.values())
    .map(r => ({
      ...r,
      avgTime: Math.round(r.times.reduce((a, b) => a + b, 0) / r.times.length),
      commonDays: findCommonDays(r.days),
      frequency: r.count / events.length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Predict by time pattern
 */
function predictByTimePattern(behaviorData, targetDay, targetHour) {
  const { timePatterns } = behaviorData;

  // Find matching time patterns (within window)
  const matches = timePatterns.filter(p => {
    if (p.day !== targetDay) return false;
    const hourDiff = Math.abs(p.hour - targetHour);
    return hourDiff <= 2; // 2-hour window
  });

  if (matches.length === 0) return null;

  // Get best match
  const bestMatch = matches.reduce((best, current) => 
    current.probability > best.probability ? current : best
  );

  if (!bestMatch.topRoute) return null;

  return {
    type: "time_pattern",
    confidence: Math.min(0.95, bestMatch.probability * 2),
    route: bestMatch.topRoute,
    suggestedTime: `${String(bestMatch.hour).padStart(2, "0")}:00`,
    reason: `You often travel this route around ${bestMatch.hour}:00 on ${getDayName(targetDay)}s`
  };
}

/**
 * Predict by day pattern
 */
function predictByDayPattern(behaviorData, targetDay) {
  const { dayPatterns } = behaviorData;
  const dayPattern = dayPatterns[targetDay];

  if (!dayPattern || !dayPattern.active || !dayPattern.topRoute) {
    return null;
  }

  return {
    type: "day_pattern",
    confidence: Math.min(0.9, dayPattern.probability * 1.5),
    route: dayPattern.topRoute,
    suggestedTime: `${String(dayPattern.avgHour).padStart(2, "0")}:00`,
    reason: `This is your usual route on ${getDayName(targetDay)}s`
  };
}

/**
 * Predict by route clusters
 */
function predictByRouteClusters(behaviorData, targetDate) {
  const { routeClusters } = behaviorData;
  const targetDay = targetDate.getDay();
  const targetHour = targetDate.getHours();

  const predictions = [];

  for (const cluster of routeClusters) {
    // Check if this cluster is relevant for target day/time
    const dayMatch = cluster.commonDays.includes(targetDay);
    const timeMatch = Math.abs(cluster.avgTime - targetHour) <= 3;

    if (!dayMatch && !timeMatch) continue;

    let confidence = cluster.frequency;
    if (dayMatch) confidence += 0.1;
    if (timeMatch) confidence += 0.1;

    predictions.push({
      type: "frequent_route",
      confidence: Math.min(0.85, confidence),
      route: {
        from: cluster.from,
        to: cluster.to
      },
      suggestedTime: `${String(cluster.avgTime).padStart(2, "0")}:00`,
      reason: `One of your most frequent routes (${cluster.count} trips)`
    });
  }

  return predictions;
}

/**
 * Enrich predictions with available rides
 */
async function enrichWithAvailableRides(predictions, targetDate) {
  const enriched = [];

  for (const prediction of predictions) {
    if (!prediction.route?.from?.coordinates || !prediction.route?.to?.coordinates) {
      continue;
    }

    const fromCoords = prediction.route.from.coordinates;
    const toCoords = prediction.route.to.coordinates;

    // Search for matching rides
    const dateStr = targetDate.toISOString().split("T")[0];
    
    const matchingRides = await Ride.find({
      date: dateStr,
      status: "scheduled",
      availableSeats: { $gte: 1 },
      "from.coordinates": {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: fromCoords },
          $maxDistance: 3000 // 3km
        }
      }
    })
      .populate("driver", "name photo reliabilityScore")
      .limit(3);

    // Filter by destination proximity
    const filteredRides = matchingRides.filter(ride => {
      if (!ride.to?.coordinates?.coordinates) return false;
      const dist = calculateDistance(
        toCoords[1], toCoords[0],
        ride.to.coordinates.coordinates[1], ride.to.coordinates.coordinates[0]
      );
      return dist <= 3; // 3km
    });

    enriched.push({
      ...prediction,
      matchingRides: filteredRides.map(r => ({
        _id: r._id,
        from: r.from,
        to: r.to,
        departureTime: r.departureTime,
        price: r.price,
        availableSeats: r.availableSeats,
        driver: {
          name: r.driver?.name,
          photo: r.driver?.photo,
          rating: r.driver?.reliabilityScore?.avgRating
        }
      })),
      hasAvailableRides: filteredRides.length > 0
    });
  }

  return enriched;
}

/**
 * Get next prediction target time
 */
function getNextPredictionTarget(now, behaviorData) {
  const hour = now.getHours();
  const day = now.getDay();

  // Find next likely travel time
  const dayPattern = behaviorData.dayPatterns[day];
  
  if (dayPattern?.active && dayPattern.avgHour > hour) {
    // Later today
    const target = new Date(now);
    target.setHours(dayPattern.avgHour, 0, 0, 0);
    return target;
  }

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // Default 9 AM

  const tomorrowPattern = behaviorData.dayPatterns[tomorrow.getDay()];
  if (tomorrowPattern?.active) {
    tomorrow.setHours(tomorrowPattern.avgHour, 0, 0, 0);
  }

  return tomorrow;
}

// Helper functions
function roundCoord(coord) {
  return Math.round(coord * 100) / 100; // ~1km precision
}

function getMostFrequentRoute(routes) {
  if (routes.length === 0) return null;

  const routeCount = {};
  routes.forEach(r => {
    const key = `${r.from?.name}-${r.to?.name}`;
    routeCount[key] = (routeCount[key] || 0) + 1;
  });

  const topKey = Object.keys(routeCount).reduce((a, b) => 
    routeCount[a] > routeCount[b] ? a : b
  );

  return routes.find(r => `${r.from?.name}-${r.to?.name}` === topKey);
}

function findPeakHours(hours) {
  const hourCount = {};
  hours.forEach(h => {
    hourCount[h] = (hourCount[h] || 0) + 1;
  });

  return Object.entries(hourCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([h]) => parseInt(h));
}

function findCommonDays(days) {
  const dayCount = {};
  days.forEach(d => {
    dayCount[d] = (dayCount[d] || 0) + 1;
  });

  return Object.entries(dayCount)
    .filter(([_, count]) => count >= 2)
    .map(([d]) => parseInt(d));
}

function getDayName(day) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
}

function isDuplicatePrediction(predictions, newPred) {
  return predictions.some(p => 
    p.route?.from?.name === newPred.route?.from?.name &&
    p.route?.to?.name === newPred.route?.to?.name
  );
}

function calculateOverallConfidence(predictions) {
  if (predictions.length === 0) return 0;
  const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
  return Math.round(avgConfidence * 100) / 100;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function extractRecentRoutes(events) {
  return events
    .filter(e => e.metadata?.from && e.metadata?.to)
    .slice(0, 5)
    .map(e => ({
      from: e.metadata.from,
      to: e.metadata.to,
      date: e.timestamp
    }));
}

module.exports = {
  predictNextRide,
  getUserBehaviorData,
  PREDICTION_CONFIG
};
