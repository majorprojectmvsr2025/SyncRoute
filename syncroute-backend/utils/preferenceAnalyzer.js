const mongoose = require("mongoose");
const UserBehaviorAnalytics = require("../models/UserBehaviorAnalytics");
const UserPreferenceProfile = require("../models/UserPreferenceProfile");

/**
 * Preference Analyzer
 * 
 * ML-based system that analyzes user behavior to extract preference patterns.
 * Uses statistical analysis and pattern recognition to build user profiles.
 */

// Minimum events required for confident analysis
const MIN_EVENTS_FOR_ANALYSIS = 3;
const MIN_EVENTS_FOR_HIGH_CONFIDENCE = 10;

// Confidence calculation based on event count
function calculateConfidence(eventCount) {
  if (eventCount < MIN_EVENTS_FOR_ANALYSIS) return 0;
  if (eventCount >= MIN_EVENTS_FOR_HIGH_CONFIDENCE) return 1;
  return (eventCount - MIN_EVENTS_FOR_ANALYSIS) / 
         (MIN_EVENTS_FOR_HIGH_CONFIDENCE - MIN_EVENTS_FOR_ANALYSIS);
}

// Normalize distribution to sum to 1
function normalizeDistribution(dist) {
  const sum = Object.values(dist).reduce((a, b) => a + b, 0);
  if (sum === 0) return dist;
  const normalized = {};
  for (const key in dist) {
    normalized[key] = Math.round((dist[key] / sum) * 1000) / 1000;
  }
  return normalized;
}

/**
 * Analyze time preferences from booking events
 */
async function analyzeTimePreferences(userId, events) {
  const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const hourCounts = {};

  for (const event of events) {
    const hour = event.rideAttributes?.departureHour;
    if (hour == null) continue;

    // Classify into time slot
    if (hour >= 6 && hour < 12) timeSlots.morning++;
    else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
    else if (hour >= 17 && hour < 21) timeSlots.evening++;
    else timeSlots.night++;

    // Count specific hours
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  // Find peak hours (top 3)
  const peakHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  const totalEvents = Object.values(timeSlots).reduce((a, b) => a + b, 0);

  return {
    ...normalizeDistribution(timeSlots),
    peakHours,
    confidence: calculateConfidence(totalEvents)
  };
}

/**
 * Analyze day preferences from booking events
 */
async function analyzeDayPreferences(userId, events) {
  const dayCounts = {
    sunday: 0, monday: 0, tuesday: 0, wednesday: 0,
    thursday: 0, friday: 0, saturday: 0
  };
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let weekdayCount = 0;
  let weekendCount = 0;

  for (const event of events) {
    const dayOfWeek = event.rideAttributes?.dayOfWeek;
    if (dayOfWeek == null) continue;

    dayCounts[dayNames[dayOfWeek]]++;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendCount++;
    } else {
      weekdayCount++;
    }
  }

  const total = weekdayCount + weekendCount;

  return {
    weekdays: total > 0 ? Math.round((weekdayCount / total) * 1000) / 1000 : 0.71,
    weekends: total > 0 ? Math.round((weekendCount / total) * 1000) / 1000 : 0.29,
    byDay: normalizeDistribution(dayCounts),
    confidence: calculateConfidence(total)
  };
}

/**
 * Analyze driver preferences from booking events
 */
async function analyzeDriverPreferences(userId, events) {
  const genderCounts = { male: 0, female: 0, unknown: 0 };
  let totalRating = 0;
  let ratingCount = 0;
  let reliabilitySum = 0;
  let reliabilityCount = 0;
  let verifiedCount = 0;
  let totalDriverEvents = 0;

  for (const event of events) {
    const attrs = event.rideAttributes;
    if (!attrs) continue;

    // Gender tracking
    if (attrs.driverGender) {
      genderCounts[attrs.driverGender] = (genderCounts[attrs.driverGender] || 0) + 1;
    } else {
      genderCounts.unknown++;
    }

    // Rating tracking
    if (attrs.driverRating) {
      totalRating += attrs.driverRating;
      ratingCount++;
    }

    // Reliability tracking
    if (attrs.driverReliabilityScore != null) {
      reliabilitySum += attrs.driverReliabilityScore;
      reliabilityCount++;
    }

    // Verified tracking
    if (attrs.driverVerified) {
      verifiedCount++;
    }

    totalDriverEvents++;
  }

  // Determine gender preference
  const maleRatio = totalDriverEvents > 0 ? genderCounts.male / totalDriverEvents : 0;
  const femaleRatio = totalDriverEvents > 0 ? genderCounts.female / totalDriverEvents : 0;
  
  let genderPreference = null;
  let genderPreferenceStrength = 0;

  if (femaleRatio > 0.7) {
    genderPreference = "female";
    genderPreferenceStrength = femaleRatio;
  } else if (maleRatio > 0.7) {
    genderPreference = "male";
    genderPreferenceStrength = maleRatio;
  }

  return {
    genderPreference,
    genderPreferenceStrength: Math.round(genderPreferenceStrength * 100) / 100,
    minRating: ratingCount > 0 ? Math.max(1, Math.round((totalRating / ratingCount) - 1) * 10) / 10 : 3.0,
    avgBookedRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 4.0,
    reliabilitySensitivity: reliabilityCount > 0 
      ? Math.round((reliabilitySum / reliabilityCount / 100) * 100) / 100 
      : 0.5,
    verifiedPreference: totalDriverEvents > 0 
      ? Math.round((verifiedCount / totalDriverEvents) * 100) / 100 
      : 0.5,
    confidence: calculateConfidence(totalDriverEvents)
  };
}

/**
 * Analyze vehicle preferences from booking events
 */
async function analyzeVehiclePreferences(userId, events) {
  const vehicleCounts = { Sedan: 0, SUV: 0, Compact: 0, Van: 0 };

  for (const event of events) {
    const vehicleType = event.rideAttributes?.vehicleType;
    if (vehicleType && vehicleCounts.hasOwnProperty(vehicleType)) {
      vehicleCounts[vehicleType]++;
    }
  }

  const total = Object.values(vehicleCounts).reduce((a, b) => a + b, 0);
  const normalized = normalizeDistribution(vehicleCounts);

  // Find primary preference
  const primary = Object.entries(vehicleCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    sedan: normalized.Sedan || 0.25,
    suv: normalized.SUV || 0.25,
    compact: normalized.Compact || 0.25,
    van: normalized.Van || 0.25,
    primary: primary && primary[1] > 0 ? primary[0] : null,
    confidence: calculateConfidence(total)
  };
}

/**
 * Analyze price preferences from booking events
 */
async function analyzePricePreferences(userId, events) {
  const prices = [];
  const pricesPerKm = [];

  for (const event of events) {
    const attrs = event.rideAttributes;
    if (!attrs) continue;

    if (attrs.price != null) prices.push(attrs.price);
    if (attrs.pricePerKm != null) pricesPerKm.push(attrs.pricePerKm);
  }

  if (prices.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 2000,
      avgPrice: 200,
      avgPricePerKm: 5,
      sensitivity: 0.5,
      confidence: 0
    };
  }

  const sortedPrices = prices.sort((a, b) => a - b);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const avgPricePerKm = pricesPerKm.length > 0 
    ? Math.round((pricesPerKm.reduce((a, b) => a + b, 0) / pricesPerKm.length) * 100) / 100 
    : 5;

  // Price sensitivity: variance normalized
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avgPrice > 0 ? stdDev / avgPrice : 0;
  const sensitivity = Math.min(1, Math.max(0, 1 - coefficientOfVariation));

  return {
    minPrice: Math.round(sortedPrices[Math.floor(sortedPrices.length * 0.1)]),
    maxPrice: Math.round(sortedPrices[Math.floor(sortedPrices.length * 0.9)]),
    avgPrice,
    avgPricePerKm,
    sensitivity: Math.round(sensitivity * 100) / 100,
    confidence: calculateConfidence(prices.length)
  };
}

/**
 * Analyze distance preferences from booking events
 */
async function analyzeDistancePreferences(userId, events) {
  const distances = [];

  for (const event of events) {
    const distance = event.rideAttributes?.distance;
    if (distance != null && distance > 0) {
      distances.push(distance / 1000); // Convert to km
    }
  }

  if (distances.length === 0) {
    return {
      short: 0.33,
      medium: 0.34,
      long: 0.33,
      avgDistance: 25,
      maxDistance: 100,
      confidence: 0
    };
  }

  let short = 0, medium = 0, long = 0;
  for (const d of distances) {
    if (d < 10) short++;
    else if (d < 50) medium++;
    else long++;
  }

  const total = distances.length;
  const avgDistance = Math.round(distances.reduce((a, b) => a + b, 0) / total);
  const maxDistance = Math.round(Math.max(...distances));

  return {
    short: Math.round((short / total) * 1000) / 1000,
    medium: Math.round((medium / total) * 1000) / 1000,
    long: Math.round((long / total) * 1000) / 1000,
    avgDistance,
    maxDistance,
    confidence: calculateConfidence(total)
  };
}

/**
 * Analyze comfort preferences from booking events
 */
async function analyzeComfortPreferences(userId, events) {
  const musicCounts = { none: 0, soft: 0, any: 0 };
  const convoCounts = { chatty: 0, quiet: 0, flexible: 0 };
  let smokingAllowed = 0;
  let totalSeatsBooked = 0;
  let totalAvailableSeats = 0;
  let seatEvents = 0;

  for (const event of events) {
    const attrs = event.rideAttributes;
    if (!attrs) continue;

    // Music preference
    if (attrs.musicPreference && musicCounts.hasOwnProperty(attrs.musicPreference)) {
      musicCounts[attrs.musicPreference]++;
    }

    // Conversation style
    if (attrs.conversationStyle && convoCounts.hasOwnProperty(attrs.conversationStyle)) {
      convoCounts[attrs.conversationStyle]++;
    }

    // Smoking
    if (attrs.smokingAllowed) smokingAllowed++;

    // Crowding (seat availability when booked)
    if (attrs.availableSeats != null && attrs.totalSeats != null) {
      totalSeatsBooked += attrs.totalSeats - attrs.availableSeats;
      totalAvailableSeats += attrs.availableSeats;
      seatEvents++;
    }
  }

  const totalMusic = Object.values(musicCounts).reduce((a, b) => a + b, 0);
  const totalConvo = Object.values(convoCounts).reduce((a, b) => a + b, 0);
  const totalComfort = Math.max(totalMusic, totalConvo, events.length);

  // Find primary preferences
  const musicPrimary = Object.entries(musicCounts).sort((a, b) => b[1] - a[1])[0];
  const convoPrimary = Object.entries(convoCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    music: normalizeDistribution(musicCounts),
    musicPrimary: musicPrimary && musicPrimary[1] > 0 ? musicPrimary[0] : null,
    conversation: normalizeDistribution(convoCounts),
    conversationPrimary: convoPrimary && convoPrimary[1] > 0 ? convoPrimary[0] : null,
    smokingTolerance: events.length > 0 ? Math.round((smokingAllowed / events.length) * 100) / 100 : 0.5,
    crowdingTolerance: seatEvents > 0 
      ? Math.round((totalAvailableSeats / (totalAvailableSeats + totalSeatsBooked)) * 100) / 100 
      : 0.5,
    confidence: calculateConfidence(totalComfort)
  };
}

/**
 * Analyze booking style preferences
 */
async function analyzeBookingStyle(userId, events) {
  let instantCount = 0;
  let waitlistCount = 0;
  let coDriverCount = 0;
  const leadTimes = [];

  for (const event of events) {
    // Booking type
    if (event.bookingDetails?.bookingType === "instant") {
      instantCount++;
    } else if (event.bookingDetails?.bookingType === "waitlist") {
      waitlistCount++;
    }

    // Lead time
    if (event.bookingDetails?.bookingLeadTime != null) {
      leadTimes.push(event.bookingDetails.bookingLeadTime);
    }

    // Co-driver
    if (event.rideAttributes?.requiresCoDriver) {
      coDriverCount++;
    }
  }

  const total = instantCount + waitlistCount;
  const avgLeadHours = leadTimes.length > 0 
    ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) 
    : 24;

  return {
    instantBookingPreference: total > 0 ? Math.round((instantCount / total) * 100) / 100 : 0.7,
    waitlistTolerance: total > 0 ? Math.round((waitlistCount / total) * 100) / 100 : 0.3,
    avgBookingLeadHours: avgLeadHours,
    lastMinuteBooker: avgLeadHours < 2,
    advancePlanner: avgLeadHours > 48,
    coDriverPreference: events.length > 0 ? Math.round((coDriverCount / events.length) * 100) / 100 : 0,
    confidence: calculateConfidence(total)
  };
}

/**
 * Analyze and cluster frequent routes
 */
async function analyzeRouteClusters(userId, events) {
  const routeMap = new Map(); // Key: "fromName|toName"

  for (const event of events) {
    const attrs = event.rideAttributes;
    if (!attrs?.fromName || !attrs?.toName) continue;

    const key = `${attrs.fromName}|${attrs.toName}`;
    
    if (!routeMap.has(key)) {
      routeMap.set(key, {
        fromLocation: {
          name: attrs.fromName,
          coordinates: event.searchContext?.pickupLocation?.coordinates || null
        },
        toLocation: {
          name: attrs.toName,
          coordinates: event.searchContext?.dropLocation?.coordinates || null
        },
        frequency: 0,
        lastTraveled: null,
        departureHours: [],
        days: []
      });
    }

    const route = routeMap.get(key);
    route.frequency++;
    route.lastTraveled = event.timestamp;
    if (attrs.departureHour != null) route.departureHours.push(attrs.departureHour);
    if (attrs.dayOfWeek != null) route.days.push(attrs.dayOfWeek);
  }

  // Convert to array and sort by frequency
  const clusters = Array.from(routeMap.values())
    .filter(r => r.frequency >= 2) // Only routes used 2+ times
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5) // Top 5 routes
    .map(route => {
      // Calculate typical departure hour (mode)
      const hourMode = route.departureHours.length > 0 
        ? route.departureHours.sort((a, b) =>
            route.departureHours.filter(v => v === a).length -
            route.departureHours.filter(v => v === b).length
          ).pop()
        : null;

      // Get unique days
      const typicalDays = [...new Set(route.days)].sort();

      // Generate label
      const fromShort = route.fromLocation.name?.split(",")[0] || "Start";
      const toShort = route.toLocation.name?.split(",")[0] || "End";
      const label = `${fromShort} → ${toShort}`;

      return {
        fromLocation: route.fromLocation,
        toLocation: route.toLocation,
        frequency: route.frequency,
        lastTraveled: route.lastTraveled,
        typicalDepartureHour: hourMode,
        typicalDays,
        label
      };
    });

  return clusters;
}

/**
 * Main analysis function - analyzes all behavior and updates preference profile
 */
async function analyzeUserPreferences(userId, forceUpdate = false) {
  try {
    console.log(`[PreferenceAnalyzer] Starting analysis for user ${userId}, forceUpdate=${forceUpdate}`);
    
    // Check if we need to analyze
    let profile = await UserPreferenceProfile.findOne({ userId });
    
    if (profile && !forceUpdate) {
      const hoursSinceLastAnalysis = profile.metadata.lastAnalyzedAt
        ? (Date.now() - profile.metadata.lastAnalyzedAt.getTime()) / (1000 * 60 * 60)
        : Infinity;
      
      // Only re-analyze if more than 6 hours since last analysis
      if (hoursSinceLastAnalysis < 6) {
        console.log(`[PreferenceAnalyzer] Profile recently analyzed, skipping`);
        return profile;
      }
    }

    // Get user's booking-related events (primary source)
    const bookingEvents = await UserBehaviorAnalytics.find({
      userId: new mongoose.Types.ObjectId(userId),
      eventType: { $in: ["booking_created", "booking_completed"] }
    }).sort({ timestamp: -1 }).limit(100).lean();

    // Get all events for comprehensive analysis
    const allEvents = await UserBehaviorAnalytics.find({
      userId: new mongoose.Types.ObjectId(userId)
    }).sort({ timestamp: -1 }).limit(200).lean();

    const searchEvents = allEvents.filter(e => e.eventType === "search");
    const viewEvents = allEvents.filter(e => e.eventType === "view_ride");
    
    console.log(`[PreferenceAnalyzer] Found ${allEvents.length} total events: ${bookingEvents.length} bookings, ${searchEvents.length} searches, ${viewEvents.length} views`);

    // Use view_ride events as supplementary data if not enough bookings
    // Views show intent, so they can help bootstrap preferences
    const primaryEvents = bookingEvents.length >= MIN_EVENTS_FOR_ANALYSIS 
      ? bookingEvents 
      : [...bookingEvents, ...viewEvents].slice(0, 100);

    // Run all analyses in parallel
    const [
      timePrefs,
      dayPrefs,
      driverPrefs,
      vehiclePrefs,
      pricePrefs,
      distancePrefs,
      comfortPrefs,
      bookingStylePrefs,
      routeClusters
    ] = await Promise.all([
      analyzeTimePreferences(userId, primaryEvents),
      analyzeDayPreferences(userId, primaryEvents),
      analyzeDriverPreferences(userId, primaryEvents),
      analyzeVehiclePreferences(userId, primaryEvents),
      analyzePricePreferences(userId, primaryEvents),
      analyzeDistancePreferences(userId, primaryEvents),
      analyzeComfortPreferences(userId, primaryEvents),
      analyzeBookingStyle(userId, bookingEvents), // Booking style only from actual bookings
      analyzeRouteClusters(userId, primaryEvents)
    ]);

    // Calculate overall confidence
    const confidences = [
      timePrefs.confidence,
      dayPrefs.confidence,
      driverPrefs.confidence,
      vehiclePrefs.confidence,
      pricePrefs.confidence,
      distancePrefs.confidence,
      comfortPrefs.confidence,
      bookingStylePrefs.confidence
    ];
    const overallConfidence = Math.round(
      (confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100
    ) / 100;

    // Profile is active if we have ANY engagement (bookings, views, or searches)
    // FIXED: Lowered activation threshold so recommendations work earlier
    // Bookings are weighted higher (count as 3), views count as 1
    const engagementScore = bookingEvents.length * 3 + viewEvents.length + searchEvents.length;
    // FIXED: Reduced minimum engagement from 3 to 1 - show recommendations sooner
    const isActive = engagementScore >= 1;
    
    console.log(`[PreferenceAnalyzer] Engagement score: ${engagementScore}, isActive: ${isActive}, confidence: ${overallConfidence}`);

    // Build profile data
    const profileData = {
      userId,
      timePreferences: timePrefs,
      dayPreferences: dayPrefs,
      driverPreferences: driverPrefs,
      vehiclePreferences: vehiclePrefs,
      pricePreferences: pricePrefs,
      distancePreferences: distancePrefs,
      comfortPreferences: comfortPrefs,
      bookingStyle: bookingStylePrefs,
      routeClusters,
      metadata: {
        totalEventsAnalyzed: allEvents.length,
        totalBookings: bookingEvents.length,
        totalSearches: searchEvents.length,
        totalViews: viewEvents.length,
        lastAnalyzedAt: new Date(),
        profileVersion: 1,
        overallConfidence,
        isActive
      }
    };

    // Upsert profile
    profile = await UserPreferenceProfile.findOneAndUpdate(
      { userId },
      profileData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[PreferenceAnalyzer] Profile updated for user ${userId}`);
    return profile;
  } catch (error) {
    console.error("[PreferenceAnalyzer] Analysis failed:", error);
    throw error;
  }
}

/**
 * Get user's preference profile (with lazy analysis)
 */
async function getUserPreferenceProfile(userId) {
  try {
    let profile = await UserPreferenceProfile.findOne({ userId }).lean();
    
    if (!profile) {
      // Create initial profile through analysis
      profile = await analyzeUserPreferences(userId, true);
    }

    return profile;
  } catch (error) {
    console.error("[PreferenceAnalyzer] Failed to get profile:", error);
    return null;
  }
}

/**
 * Batch analyze multiple users (for background job)
 */
async function batchAnalyzeUsers(userIds) {
  const results = { success: 0, failed: 0 };
  
  for (const userId of userIds) {
    try {
      await analyzeUserPreferences(userId, true);
      results.success++;
    } catch {
      results.failed++;
    }
  }

  return results;
}

/**
 * Get users with stale profiles that need re-analysis
 */
async function getStaleProfiles(hoursOld = 24, limit = 100) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursOld);

  return await UserPreferenceProfile.find({
    $or: [
      { "metadata.lastAnalyzedAt": { $lt: cutoff } },
      { "metadata.lastAnalyzedAt": null }
    ]
  })
  .select("userId")
  .limit(limit)
  .lean();
}

module.exports = {
  analyzeUserPreferences,
  getUserPreferenceProfile,
  batchAnalyzeUsers,
  getStaleProfiles,
  MIN_EVENTS_FOR_ANALYSIS,
  MIN_EVENTS_FOR_HIGH_CONFIDENCE
};
