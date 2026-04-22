const { getUserPreferenceProfile } = require("./preferenceAnalyzer");
const { getReliabilityScore } = require("./reliabilityCalculator");
const { closestRoutePoint, segmentDistance } = require("./rideMatchUtils");

/**
 * Personalized Ride Scorer
 * 
 * Hybrid ML scoring model that ranks rides based on user preferences.
 * Generates personalized scores and explainable recommendations.
 */

// Scoring weights (tunable hyperparameters)
const WEIGHTS = {
  routeMatch: 0.20,      // Route familiarity and overlap quality
  timeMatch: 0.18,       // Departure time alignment
  driverMatch: 0.15,     // Driver preferences (gender, rating, reliability)
  vehicleMatch: 0.12,    // Vehicle type preference
  priceMatch: 0.15,      // Price range comfort
  comfortMatch: 0.10,    // Music, conversation, smoking preferences
  bookingStyleMatch: 0.10 // Instant booking, co-driver preferences
};

// Score thresholds for recommendations
const RECOMMENDATION_THRESHOLD = 0.7;   // Score >= 0.7 = "Recommended"
const STRONG_MATCH_THRESHOLD = 0.85;    // Score >= 0.85 = Strong match (multiple reasons)

/**
 * Calculate time preference score (0-1)
 */
function calculateTimeScore(ride, profile) {
  if (!profile?.timePreferences || profile.timePreferences.confidence === 0) {
    return { score: 0.5, reason: null };
  }

  const departureHour = parseInt(ride.departureTime?.split(":")[0] || "12");
  
  // Classify ride's departure time
  let timeSlot;
  if (departureHour >= 6 && departureHour < 12) timeSlot = "morning";
  else if (departureHour >= 12 && departureHour < 17) timeSlot = "afternoon";
  else if (departureHour >= 17 && departureHour < 21) timeSlot = "evening";
  else timeSlot = "night";

  // Score based on preference distribution
  const slotPreference = profile.timePreferences[timeSlot] || 0.25;
  
  // Bonus for peak hours
  let peakBonus = 0;
  if (profile.timePreferences.peakHours?.includes(departureHour)) {
    peakBonus = 0.2;
  }

  const score = Math.min(1, slotPreference * 2 + peakBonus);
  
  // Generate reason if significant match
  let reason = null;
  if (slotPreference > 0.4) {
    const timeSlotLabel = {
      morning: "in the morning",
      afternoon: "in the afternoon", 
      evening: "in the evening",
      night: "at night"
    }[timeSlot];
    reason = `You usually travel ${timeSlotLabel}`;
  } else if (peakBonus > 0) {
    reason = `Departs at ${ride.departureTime}, your preferred time`;
  }

  return { score, reason };
}

/**
 * Calculate day preference score (0-1)
 */
function calculateDayScore(ride, profile) {
  if (!profile?.dayPreferences || profile.dayPreferences.confidence === 0) {
    return { score: 0.5, reason: null };
  }

  const rideDate = new Date(ride.date);
  const dayOfWeek = rideDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Score based on weekday/weekend preference
  const weekdayPref = profile.dayPreferences.weekdays || 0.71;
  const weekendPref = profile.dayPreferences.weekends || 0.29;

  let score;
  let reason = null;

  if (isWeekend) {
    score = weekendPref * 2;
    if (weekendPref > 0.4) {
      reason = "Matches your weekend travel pattern";
    }
  } else {
    score = weekdayPref * 1.4;
    if (weekdayPref > 0.75) {
      reason = "Matches your weekday commute pattern";
    }
  }

  return { score: Math.min(1, score), reason };
}

/**
 * Calculate driver preference score (0-1)
 */
async function calculateDriverScore(ride, profile) {
  if (!profile?.driverPreferences || profile.driverPreferences.confidence === 0) {
    return { score: 0.5, reasons: [] };
  }

  const driver = ride.driver || {};
  const prefs = profile.driverPreferences;
  const reasons = [];
  let scoreSum = 0;
  let weightSum = 0;

  // Gender preference
  if (prefs.genderPreference && driver.gender) {
    const genderMatch = prefs.genderPreference === driver.gender || prefs.genderPreference === "any";
    if (genderMatch && prefs.genderPreferenceStrength > 0.6) {
      scoreSum += 1 * prefs.genderPreferenceStrength;
      reasons.push(`${driver.gender === "female" ? "Female" : "Male"} driver, as you prefer`);
    } else if (!genderMatch) {
      scoreSum += 0.3;
    } else {
      scoreSum += 0.7;
    }
    weightSum += 1;
  }

  // Rating preference
  if (driver.rating != null) {
    const ratingScore = driver.rating >= prefs.avgBookedRating 
      ? 1 
      : driver.rating / prefs.avgBookedRating;
    
    if (driver.rating >= 4.5 && prefs.avgBookedRating >= 4.0) {
      reasons.push(`High-rated driver (${driver.rating}★)`);
    }
    
    scoreSum += ratingScore;
    weightSum += 1;
  }

  // Reliability preference
  if (prefs.reliabilitySensitivity > 0.6) {
    try {
      const reliability = await getReliabilityScore(driver._id || ride.driver);
      if (reliability?.score >= 80) {
        scoreSum += 1;
        reasons.push("Highly reliable driver");
      } else if (reliability?.score >= 60) {
        scoreSum += 0.7;
      } else {
        scoreSum += 0.4;
      }
      weightSum += 1;
    } catch {
      // Skip reliability scoring if unavailable
    }
  }

  // Verified preference
  if (prefs.verifiedPreference > 0.6 && driver.driverVerified) {
    scoreSum += 1;
    reasons.push("Verified driver");
    weightSum += 1;
  }

  const score = weightSum > 0 ? scoreSum / weightSum : 0.5;
  return { score, reasons };
}

/**
 * Calculate vehicle preference score (0-1)
 */
function calculateVehicleScore(ride, profile) {
  if (!profile?.vehiclePreferences || profile.vehiclePreferences.confidence === 0) {
    return { score: 0.5, reason: null };
  }

  const vehicleType = ride.vehicleType?.toLowerCase() || "sedan";
  const prefs = profile.vehiclePreferences;

  // Map to preference keys
  const typeMap = { sedan: "sedan", suv: "suv", compact: "compact", van: "van" };
  const prefKey = typeMap[vehicleType] || "sedan";
  const preference = prefs[prefKey] || 0.25;

  // Score based on preference distribution
  const score = Math.min(1, preference * 3);

  // Check if this is primary preference
  let reason = null;
  if (prefs.primary?.toLowerCase() === vehicleType && preference > 0.35) {
    reason = `${ride.vehicleType} - your preferred vehicle type`;
  }

  return { score, reason };
}

/**
 * Calculate price preference score (0-1)
 */
function calculatePriceScore(ride, profile) {
  if (!profile?.pricePreferences || profile.pricePreferences.confidence === 0) {
    return { score: 0.5, reason: null };
  }

  const price = ride.effectivePrice || ride.price;
  const prefs = profile.pricePreferences;

  // Perfect score if within comfortable range
  if (price >= prefs.minPrice && price <= prefs.maxPrice) {
    const distanceFromAvg = Math.abs(price - prefs.avgPrice);
    const range = prefs.maxPrice - prefs.minPrice;
    const normalizedDist = range > 0 ? distanceFromAvg / range : 0;
    
    const score = 1 - (normalizedDist * 0.3); // Small penalty for being far from average
    
    let reason = null;
    if (price <= prefs.avgPrice && prefs.sensitivity > 0.5) {
      reason = "Within your preferred price range";
    }
    
    return { score, reason };
  }

  // Outside range - apply penalty based on how far outside
  if (price < prefs.minPrice) {
    return { score: 0.8, reason: "Below your usual price range" };
  }

  // Above max
  const overage = (price - prefs.maxPrice) / prefs.maxPrice;
  const score = Math.max(0.2, 1 - overage);
  
  return { score, reason: null };
}

/**
 * Calculate comfort preference score (0-1)
 */
function calculateComfortScore(ride, profile) {
  if (!profile?.comfortPreferences || profile.comfortPreferences.confidence === 0) {
    return { score: 0.5, reasons: [] };
  }

  const prefs = profile.comfortPreferences;
  const reasons = [];
  let scoreSum = 0;
  let weightSum = 0;

  // Music preference
  if (ride.musicPreference && prefs.music) {
    const musicScore = prefs.music[ride.musicPreference] || 0.33;
    if (prefs.musicPrimary === ride.musicPreference && musicScore > 0.4) {
      reasons.push(`${ride.musicPreference === "none" ? "Silent" : ride.musicPreference === "soft" ? "Soft music" : "Music"} ride, as you prefer`);
    }
    scoreSum += musicScore * 2;
    weightSum += 1;
  }

  // Conversation style
  if (ride.conversationStyle && prefs.conversation) {
    const convoScore = prefs.conversation[ride.conversationStyle] || 0.33;
    if (prefs.conversationPrimary === ride.conversationStyle && convoScore > 0.4) {
      reasons.push(`${ride.conversationStyle === "quiet" ? "Quiet" : ride.conversationStyle === "chatty" ? "Social" : "Flexible"} ride atmosphere`);
    }
    scoreSum += convoScore * 2;
    weightSum += 1;
  }

  // Smoking preference
  if (ride.smokingAllowed != null) {
    const smokingScore = ride.smokingAllowed ? prefs.smokingTolerance : 1;
    if (!ride.smokingAllowed && prefs.smokingTolerance < 0.3) {
      reasons.push("Non-smoking ride");
    }
    scoreSum += smokingScore;
    weightSum += 1;
  }

  // Seat availability (crowding)
  if (ride.availableSeats != null && ride.totalSeats != null) {
    const fillRate = (ride.totalSeats - ride.availableSeats) / ride.totalSeats;
    const crowdScore = 1 - (fillRate * (1 - prefs.crowdingTolerance));
    scoreSum += crowdScore;
    weightSum += 1;
  }

  const score = weightSum > 0 ? Math.min(1, scoreSum / weightSum) : 0.5;
  return { score, reasons };
}

/**
 * Calculate booking style preference score (0-1)
 */
function calculateBookingStyleScore(ride, profile) {
  if (!profile?.bookingStyle || profile.bookingStyle.confidence === 0) {
    return { score: 0.5, reason: null };
  }

  const prefs = profile.bookingStyle;
  let scoreSum = 0;
  let weightSum = 0;
  let reason = null;

  // Instant booking preference
  if (ride.instantBooking != null) {
    const instantScore = ride.instantBooking 
      ? prefs.instantBookingPreference 
      : prefs.waitlistTolerance;
    
    if (ride.instantBooking && prefs.instantBookingPreference > 0.7) {
      reason = "Instant booking available";
    }
    
    scoreSum += instantScore * 1.5;
    weightSum += 1;
  }

  // Co-driver preference
  if (ride.requiresCoDriver) {
    if (prefs.coDriverPreference > 0.5) {
      scoreSum += 1;
      reason = reason || "Co-driver ride, as you prefer";
    } else {
      scoreSum += 0.5;
    }
    weightSum += 1;
  }

  const score = weightSum > 0 ? Math.min(1, scoreSum / weightSum) : 0.5;
  return { score, reason };
}

/**
 * Calculate route familiarity score (0-1)
 */
function calculateRouteScore(ride, profile, searchCoords = null) {
  if (!profile?.routeClusters || profile.routeClusters.length === 0) {
    return { score: 0.5, reason: null };
  }

  // Check if this route matches any frequent routes
  const rideFrom = ride.from?.name?.toLowerCase() || "";
  const rideTo = ride.to?.name?.toLowerCase() || "";

  for (const cluster of profile.routeClusters) {
    const clusterFrom = cluster.fromLocation?.name?.toLowerCase() || "";
    const clusterTo = cluster.toLocation?.name?.toLowerCase() || "";

    // Simple string matching for route names
    const fromMatch = rideFrom.includes(clusterFrom.split(",")[0]) || 
                      clusterFrom.includes(rideFrom.split(",")[0]);
    const toMatch = rideTo.includes(clusterTo.split(",")[0]) || 
                    clusterTo.includes(rideTo.split(",")[0]);

    if (fromMatch && toMatch) {
      const frequencyBonus = Math.min(0.3, cluster.frequency * 0.05);
      return {
        score: Math.min(1, 0.8 + frequencyBonus),
        reason: `Matches your frequent route: ${cluster.label}`
      };
    }

    // Partial match
    if (fromMatch || toMatch) {
      return {
        score: 0.7,
        reason: `Similar to your frequent routes`
      };
    }
  }

  return { score: 0.5, reason: null };
}

/**
 * Main scoring function - calculates personalized score for a ride
 * FIXED: Now provides recommendations even for users with limited data
 */
async function scoreRide(ride, userId, searchCoords = null) {
  try {
    // Get user's preference profile
    const profile = await getUserPreferenceProfile(userId);
    
    // FIXED: Still try to score rides even without full profile
    // This allows recommendations based on ride quality (rating, verification, etc.)
    const hasProfile = profile && profile.metadata;
    const isActiveProfile = hasProfile && profile.metadata.isActive;
    
    if (!hasProfile) {
      console.log(`[PersonalizedScorer] No profile found for user ${userId}, using default scoring`);
    } else if (!isActiveProfile) {
      console.log(`[PersonalizedScorer] Profile not fully active for user ${userId} (events: ${profile.metadata?.totalEventsAnalyzed || 0}), using partial scoring`);
    }

    // Calculate all component scores (works with partial/empty profile)
    const timeResult = calculateTimeScore(ride, profile || {});
    const dayResult = calculateDayScore(ride, profile || {});
    const driverResult = await calculateDriverScore(ride, profile || {});
    const vehicleResult = calculateVehicleScore(ride, profile || {});
    const priceResult = calculatePriceScore(ride, profile || {});
    const comfortResult = calculateComfortScore(ride, profile || {});
    const bookingResult = calculateBookingStyleScore(ride, profile || {});
    const routeResult = calculateRouteScore(ride, profile || {}, searchCoords);

    // Calculate weighted score
    const weightedScore = 
      WEIGHTS.timeMatch * timeResult.score +
      WEIGHTS.routeMatch * routeResult.score +
      WEIGHTS.driverMatch * driverResult.score +
      WEIGHTS.vehicleMatch * vehicleResult.score +
      WEIGHTS.priceMatch * priceResult.score +
      WEIGHTS.comfortMatch * comfortResult.score +
      WEIGHTS.bookingStyleMatch * bookingResult.score;

    // Apply day score as multiplier (not weighted - contextual)
    const finalScore = Math.min(1, weightedScore * (0.8 + dayResult.score * 0.2));

    // Collect all reasons
    const allReasons = [
      routeResult.reason,
      timeResult.reason,
      dayResult.reason,
      ...driverResult.reasons,
      vehicleResult.reason,
      priceResult.reason,
      ...comfortResult.reasons,
      bookingResult.reason
    ].filter(Boolean);

    // FIXED: Add quality-based reasons for users without full profiles
    if (!isActiveProfile && allReasons.length === 0) {
      // Add default quality-based recommendations
      if (ride.driver?.rating >= 4.5) {
        allReasons.push(`Highly rated driver (${ride.driver.rating}★)`);
      }
      if (ride.driver?.driverVerification?.isVerified) {
        allReasons.push("Verified driver");
      }
      if (ride.instantBooking) {
        allReasons.push("Instant booking available");
      }
      if (ride.availableSeats >= 2) {
        allReasons.push("Multiple seats available");
      }
    }

    // Select top reasons (max 3)
    const topReasons = allReasons.slice(0, 3);

    // FIXED: Lower threshold for recommendations when user has limited data
    // This ensures users see recommendations even before building full profile
    const effectiveThreshold = isActiveProfile ? RECOMMENDATION_THRESHOLD : 0.5;
    const isRecommended = finalScore >= effectiveThreshold && topReasons.length > 0;
    const isStrongMatch = finalScore >= STRONG_MATCH_THRESHOLD;

    return {
      score: Math.round(finalScore * 100) / 100,
      isPersonalized: isActiveProfile,
      isRecommended,
      isStrongMatch,
      reasons: topReasons,
      primaryReason: topReasons[0] || null,
      breakdown: {
        time: Math.round(timeResult.score * 100),
        day: Math.round(dayResult.score * 100),
        driver: Math.round(driverResult.score * 100),
        vehicle: Math.round(vehicleResult.score * 100),
        price: Math.round(priceResult.score * 100),
        comfort: Math.round(comfortResult.score * 100),
        bookingStyle: Math.round(bookingResult.score * 100),
        route: Math.round(routeResult.score * 100)
      },
      confidence: profile?.metadata?.overallConfidence || 0
    };
  } catch (error) {
    console.error("[PersonalizedScorer] Scoring failed:", error);
    return {
      score: 0.5,
      isPersonalized: false,
      isRecommended: false,
      reasons: [],
      breakdown: null
    };
  }
}

/**
 * Score and rank multiple rides
 */
async function scoreAndRankRides(rides, userId, searchCoords = null) {
  try {
    console.log(`[PersonalizedScorer] Scoring ${rides.length} rides for user ${userId}`);
    
    // Score all rides in parallel
    const scoredRides = await Promise.all(
      rides.map(async (ride) => {
        const scoring = await scoreRide(ride, userId, searchCoords);
        return {
          ...ride,
          personalization: scoring
        };
      })
    );

    // Sort by personalized score (descending)
    scoredRides.sort((a, b) => {
      // Recommended rides first
      if (a.personalization.isRecommended !== b.personalization.isRecommended) {
        return a.personalization.isRecommended ? -1 : 1;
      }
      // Then by score
      return b.personalization.score - a.personalization.score;
    });

    const recommendedCount = scoredRides.filter(r => r.personalization.isRecommended).length;
    const personalizedCount = scoredRides.filter(r => r.personalization.isPersonalized).length;
    
    console.log(`[PersonalizedScorer] Ranked ${rides.length} rides: ${recommendedCount} recommended, ${personalizedCount} personalized`);

    return scoredRides;
  } catch (error) {
    console.error("[PersonalizedScorer] Ranking failed:", error);
    return rides.map(ride => ({
      ...ride,
      personalization: {
        score: 0.5,
        isPersonalized: false,
        isRecommended: false,
        reasons: []
      }
    }));
  }
}

/**
 * Get personalized ride suggestions based on user's patterns
 */
async function getPersonalizedSuggestions(userId, limit = 5) {
  try {
    const profile = await getUserPreferenceProfile(userId);
    
    if (!profile || !profile.metadata?.isActive) {
      return { suggestions: [], hasProfile: false };
    }

    const suggestions = [];

    // Suggest based on peak hours
    if (profile.timePreferences?.peakHours?.length > 0) {
      const peakHour = profile.timePreferences.peakHours[0];
      const timeStr = `${peakHour.toString().padStart(2, "0")}:00`;
      suggestions.push({
        type: "time_based",
        title: "Your usual travel time",
        description: `You often travel around ${timeStr}`,
        searchParams: {
          departureWindow: peakHour < 12 ? "Morning" : peakHour < 17 ? "Afternoon" : "Evening"
        }
      });
    }

    // Suggest based on frequent routes
    for (const cluster of profile.routeClusters?.slice(0, 2) || []) {
      suggestions.push({
        type: "route_based",
        title: cluster.label,
        description: `Traveled ${cluster.frequency} times`,
        searchParams: {
          fromName: cluster.fromLocation?.name,
          toName: cluster.toLocation?.name,
          fromCoords: cluster.fromLocation?.coordinates,
          toCoords: cluster.toLocation?.coordinates
        }
      });
    }

    // Suggest based on day patterns
    if (profile.dayPreferences?.confidence > 0.5) {
      const isWeekendPerson = profile.dayPreferences.weekends > 0.4;
      suggestions.push({
        type: "day_based",
        title: isWeekendPerson ? "Weekend traveler" : "Weekday commuter",
        description: `You travel mostly on ${isWeekendPerson ? "weekends" : "weekdays"}`,
        searchParams: {}
      });
    }

    return {
      suggestions: suggestions.slice(0, limit),
      hasProfile: true,
      profileConfidence: profile.metadata.overallConfidence
    };
  } catch (error) {
    console.error("[PersonalizedScorer] Suggestions failed:", error);
    return { suggestions: [], hasProfile: false };
  }
}

module.exports = {
  scoreRide,
  scoreAndRankRides,
  getPersonalizedSuggestions,
  RECOMMENDATION_THRESHOLD,
  STRONG_MATCH_THRESHOLD,
  WEIGHTS
};
