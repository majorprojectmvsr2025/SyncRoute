/**
 * Fraud Detection System
 * 
 * ML-based anomaly detection for suspicious user behavior
 * using Isolation Forest-like approach and rule-based heuristics.
 */

const User = require("../models/User");
const Booking = require("../models/Booking");
const Ride = require("../models/Ride");
const Review = require("../models/Review");

// Fraud detection thresholds
const FRAUD_CONFIG = {
  // Cancellation patterns
  cancellation: {
    windowHours: 168, // 7 days
    normalThreshold: 3,
    warningThreshold: 5,
    criticalThreshold: 10,
    rateThreshold: 0.4 // 40% cancellation rate
  },
  
  // Account patterns
  account: {
    minAccountAgeHours: 1,
    suspiciousActivityWindow: 24, // hours
    maxRidesPerHour: 5,
    maxBookingsPerHour: 10
  },
  
  // Review patterns
  review: {
    minWordCount: 3,
    maxReviewsPerDay: 10,
    suspiciousRatingDeviation: 2 // Std deviations from user's avg
  },
  
  // Booking patterns
  booking: {
    maxSameDayBookings: 8,
    suspiciousTimeGapMinutes: 5, // Back-to-back bookings
    maxConcurrentBookings: 3
  },
  
  // Risk score weights
  weights: {
    cancellationPattern: 0.25,
    accountAge: 0.15,
    activityVolume: 0.15,
    reviewPattern: 0.15,
    bookingPattern: 0.15,
    verificationStatus: 0.15
  },
  
  // Risk levels
  riskLevels: {
    low: { max: 0.3, action: "none" },
    medium: { max: 0.5, action: "monitor" },
    high: { max: 0.7, action: "review" },
    critical: { max: 1.0, action: "suspend" }
  }
};

/**
 * Statistical helper: calculate mean
 */
function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Statistical helper: calculate standard deviation
 */
function stdDev(arr) {
  if (arr.length === 0) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Isolation Forest-inspired anomaly score
 * Calculates how "isolated" a data point is
 */
function isolationScore(value, distribution) {
  if (distribution.length === 0) return 0.5;
  
  const avg = mean(distribution);
  const std = stdDev(distribution);
  
  if (std === 0) return value === avg ? 0 : 1;
  
  // Z-score normalized to 0-1
  const zScore = Math.abs((value - avg) / std);
  return Math.min(1, zScore / 3); // Cap at 3 std devs
}

/**
 * Analyze cancellation patterns
 */
async function analyzeCancellationPattern(userId) {
  const windowStart = new Date(Date.now() - FRAUD_CONFIG.cancellation.windowHours * 60 * 60 * 1000);
  
  // Get recent bookings
  const bookings = await Booking.find({
    passenger: userId,
    createdAt: { $gte: windowStart }
  }).lean();
  
  const cancelled = bookings.filter(b => b.status === "cancelled");
  const cancellationRate = bookings.length > 0 ? cancelled.length / bookings.length : 0;
  
  // Calculate score
  let score = 0;
  let flags = [];
  
  if (cancelled.length >= FRAUD_CONFIG.cancellation.criticalThreshold) {
    score = 1.0;
    flags.push("excessive_cancellations");
  } else if (cancelled.length >= FRAUD_CONFIG.cancellation.warningThreshold) {
    score = 0.7;
    flags.push("high_cancellations");
  } else if (cancelled.length >= FRAUD_CONFIG.cancellation.normalThreshold) {
    score = 0.4;
  }
  
  if (cancellationRate > FRAUD_CONFIG.cancellation.rateThreshold) {
    score = Math.max(score, 0.6);
    flags.push("high_cancellation_rate");
  }
  
  return {
    score,
    flags,
    metrics: {
      totalBookings: bookings.length,
      cancellations: cancelled.length,
      cancellationRate: Math.round(cancellationRate * 100)
    }
  };
}

/**
 * Analyze account age and patterns
 */
async function analyzeAccountPattern(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return { score: 0.5, flags: ["user_not_found"], metrics: {} };
  
  const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
  
  let score = 0;
  const flags = [];
  
  // Very new account
  if (accountAgeHours < FRAUD_CONFIG.account.minAccountAgeHours) {
    score = 0.8;
    flags.push("very_new_account");
  } else if (accountAgeHours < 24) {
    score = 0.4;
    flags.push("new_account");
  }
  
  // Check verification status
  if (!user.email || !user.phone) {
    score = Math.max(score, 0.3);
    flags.push("incomplete_profile");
  }
  
  // Check if driver verified
  if (user.role === "driver" && !user.driverVerification?.isVerified) {
    score = Math.max(score, 0.2);
  }
  
  return {
    score,
    flags,
    metrics: {
      accountAgeHours: Math.round(accountAgeHours),
      hasEmail: !!user.email,
      hasPhone: !!user.phone,
      isVerified: user.driverVerification?.isVerified || false
    }
  };
}

/**
 * Analyze activity volume
 */
async function analyzeActivityVolume(userId) {
  const windowStart = new Date(Date.now() - FRAUD_CONFIG.account.suspiciousActivityWindow * 60 * 60 * 1000);
  
  // Count recent rides created
  const ridesCreated = await Ride.countDocuments({
    driver: userId,
    createdAt: { $gte: windowStart }
  });
  
  // Count recent bookings
  const bookingsMade = await Booking.countDocuments({
    passenger: userId,
    createdAt: { $gte: windowStart }
  });
  
  const ridesPerHour = ridesCreated / FRAUD_CONFIG.account.suspiciousActivityWindow;
  const bookingsPerHour = bookingsMade / FRAUD_CONFIG.account.suspiciousActivityWindow;
  
  let score = 0;
  const flags = [];
  
  if (ridesPerHour > FRAUD_CONFIG.account.maxRidesPerHour) {
    score = 0.8;
    flags.push("spam_ride_creation");
  }
  
  if (bookingsPerHour > FRAUD_CONFIG.account.maxBookingsPerHour) {
    score = Math.max(score, 0.7);
    flags.push("spam_bookings");
  }
  
  return {
    score,
    flags,
    metrics: {
      ridesCreated,
      bookingsMade,
      ridesPerHour: Math.round(ridesPerHour * 10) / 10,
      bookingsPerHour: Math.round(bookingsPerHour * 10) / 10
    }
  };
}

/**
 * Analyze review patterns
 */
async function analyzeReviewPattern(userId) {
  // Reviews given by user
  const reviewsGiven = await Review.find({ reviewer: userId }).lean();
  
  // Reviews received
  const reviewsReceived = await Review.find({ reviewee: userId }).lean();
  
  let score = 0;
  const flags = [];
  
  // Check for review manipulation
  if (reviewsGiven.length > 0) {
    const ratings = reviewsGiven.map(r => r.rating);
    const avgRating = mean(ratings);
    const ratingStd = stdDev(ratings);
    
    // All same ratings (suspicious)
    if (ratingStd === 0 && reviewsGiven.length > 3) {
      score = 0.5;
      flags.push("uniform_ratings");
    }
    
    // Check for very short reviews
    const shortReviews = reviewsGiven.filter(r => 
      !r.comment || r.comment.split(/\s+/).length < FRAUD_CONFIG.review.minWordCount
    );
    
    if (shortReviews.length / reviewsGiven.length > 0.8) {
      score = Math.max(score, 0.3);
      flags.push("low_quality_reviews");
    }
    
    // Check for review bombing (many reviews in short time)
    const last24h = reviewsGiven.filter(r => 
      Date.now() - new Date(r.createdAt).getTime() < 24 * 60 * 60 * 1000
    );
    
    if (last24h.length > FRAUD_CONFIG.review.maxReviewsPerDay) {
      score = Math.max(score, 0.7);
      flags.push("review_flooding");
    }
  }
  
  return {
    score,
    flags,
    metrics: {
      reviewsGiven: reviewsGiven.length,
      reviewsReceived: reviewsReceived.length,
      avgRatingGiven: reviewsGiven.length > 0 ? mean(reviewsGiven.map(r => r.rating)) : null
    }
  };
}

/**
 * Analyze booking patterns
 */
async function analyzeBookingPattern(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todaysBookings = await Booking.find({
    passenger: userId,
    createdAt: { $gte: today }
  }).sort({ createdAt: 1 }).lean();
  
  let score = 0;
  const flags = [];
  
  // Too many same-day bookings
  if (todaysBookings.length > FRAUD_CONFIG.booking.maxSameDayBookings) {
    score = 0.6;
    flags.push("excessive_daily_bookings");
  }
  
  // Check for back-to-back bookings (potential abuse)
  if (todaysBookings.length >= 2) {
    for (let i = 1; i < todaysBookings.length; i++) {
      const gap = (new Date(todaysBookings[i].createdAt) - new Date(todaysBookings[i-1].createdAt)) / (1000 * 60);
      
      if (gap < FRAUD_CONFIG.booking.suspiciousTimeGapMinutes) {
        score = Math.max(score, 0.4);
        flags.push("rapid_bookings");
        break;
      }
    }
  }
  
  // Check concurrent confirmed bookings
  const confirmedBookings = todaysBookings.filter(b => 
    b.status === "confirmed" || b.status === "pending"
  );
  
  if (confirmedBookings.length > FRAUD_CONFIG.booking.maxConcurrentBookings) {
    score = Math.max(score, 0.5);
    flags.push("too_many_concurrent");
  }
  
  return {
    score,
    flags,
    metrics: {
      todaysBookings: todaysBookings.length,
      confirmedBookings: confirmedBookings.length
    }
  };
}

/**
 * Calculate overall fraud risk score
 */
async function calculateFraudRisk(userId) {
  try {
    // Run all analyses in parallel
    const [
      cancellationAnalysis,
      accountAnalysis,
      activityAnalysis,
      reviewAnalysis,
      bookingAnalysis
    ] = await Promise.all([
      analyzeCancellationPattern(userId),
      analyzeAccountPattern(userId),
      analyzeActivityVolume(userId),
      analyzeReviewPattern(userId),
      analyzeBookingPattern(userId)
    ]);
    
    const weights = FRAUD_CONFIG.weights;
    
    // Calculate weighted score
    const weightedScore = 
      cancellationAnalysis.score * weights.cancellationPattern +
      accountAnalysis.score * weights.accountAge +
      activityAnalysis.score * weights.activityVolume +
      reviewAnalysis.score * weights.reviewPattern +
      bookingAnalysis.score * weights.bookingPattern +
      (1 - (accountAnalysis.metrics.isVerified ? 1 : 0)) * weights.verificationStatus;
    
    // Collect all flags
    const allFlags = [
      ...cancellationAnalysis.flags,
      ...accountAnalysis.flags,
      ...activityAnalysis.flags,
      ...reviewAnalysis.flags,
      ...bookingAnalysis.flags
    ];
    
    // Determine risk level
    let riskLevel = "low";
    let recommendedAction = "none";
    
    const levels = FRAUD_CONFIG.riskLevels;
    if (weightedScore > levels.high.max) {
      riskLevel = "critical";
      recommendedAction = levels.critical.action;
    } else if (weightedScore > levels.medium.max) {
      riskLevel = "high";
      recommendedAction = levels.high.action;
    } else if (weightedScore > levels.low.max) {
      riskLevel = "medium";
      recommendedAction = levels.medium.action;
    }
    
    return {
      userId,
      riskScore: Math.round(weightedScore * 100) / 100,
      riskLevel,
      recommendedAction,
      flags: allFlags,
      analyzedAt: new Date().toISOString(),
      breakdown: {
        cancellation: {
          score: cancellationAnalysis.score,
          ...cancellationAnalysis.metrics
        },
        account: {
          score: accountAnalysis.score,
          ...accountAnalysis.metrics
        },
        activity: {
          score: activityAnalysis.score,
          ...activityAnalysis.metrics
        },
        review: {
          score: reviewAnalysis.score,
          ...reviewAnalysis.metrics
        },
        booking: {
          score: bookingAnalysis.score,
          ...bookingAnalysis.metrics
        }
      }
    };
  } catch (error) {
    console.error("Fraud analysis error:", error);
    return {
      userId,
      riskScore: 0.5,
      riskLevel: "unknown",
      recommendedAction: "review",
      error: error.message
    };
  }
}

/**
 * Quick fraud check (lightweight)
 */
async function quickFraudCheck(userId) {
  const result = await calculateFraudRisk(userId);
  
  return {
    isSafe: result.riskLevel === "low" || result.riskLevel === "medium",
    riskLevel: result.riskLevel,
    shouldBlock: result.riskLevel === "critical",
    requiresReview: result.riskLevel === "high"
  };
}

/**
 * Batch analyze users
 */
async function batchAnalyzeUsers(userIds) {
  const results = await Promise.all(
    userIds.map(id => calculateFraudRisk(id))
  );
  
  return results.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Get high-risk users for admin review
 */
async function getHighRiskUsers(limit = 20) {
  // Get recently active users
  const recentUsers = await User.find({
    updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  })
    .select("_id")
    .limit(100)
    .lean();
  
  const userIds = recentUsers.map(u => u._id);
  const results = await batchAnalyzeUsers(userIds);
  
  return results
    .filter(r => r.riskLevel === "high" || r.riskLevel === "critical")
    .slice(0, limit);
}

module.exports = {
  calculateFraudRisk,
  quickFraudCheck,
  batchAnalyzeUsers,
  getHighRiskUsers,
  FRAUD_CONFIG,
  
  // Individual analyzers for testing
  analyzeCancellationPattern,
  analyzeAccountPattern,
  analyzeActivityVolume,
  analyzeReviewPattern,
  analyzeBookingPattern
};
