/**
 * Driver Reliability Score Calculator
 * 
 * Calculates a reliability score (0-100) based on:
 * - Ride completion rate (weight: 30%)
 * - Punctuality rate (weight: 25%)
 * - Average passenger rating (weight: 30%)
 * - Cancellation rate (weight: 15%)
 */

const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const User = require("../models/User");

// Weights for score calculation
const WEIGHTS = {
  completionRate: 0.30,
  punctualityRate: 0.25,
  avgRating: 0.30,
  cancellationPenalty: 0.15
};

/**
 * Calculate completion rate (completed rides / total rides)
 */
async function calculateCompletionRate(driverId) {
  const totalRides = await Ride.countDocuments({ driver: driverId });
  if (totalRides === 0) return 100;
  
  const completedRides = await Ride.countDocuments({
    driver: driverId,
    status: "completed"
  });
  
  return Math.round((completedRides / totalRides) * 100);
}

/**
 * Calculate punctuality rate based on ride start times
 * A ride is "on-time" if started within 10 minutes of scheduled time
 */
async function calculatePunctualityRate(driverId) {
  const completedRides = await Ride.find({
    driver: driverId,
    status: { $in: ["completed", "in-progress"] },
    "rideConfirmation.rideStartedAt": { $exists: true, $ne: null }
  }).select("date departureTime rideConfirmation.rideStartedAt");
  
  if (completedRides.length === 0) return 100;
  
  let onTimeCount = 0;
  const ALLOWED_LATE_MINUTES = 10;
  
  for (const ride of completedRides) {
    if (!ride.rideConfirmation?.rideStartedAt) continue;
    
    // Parse scheduled datetime
    const scheduledDate = new Date(`${ride.date}T${ride.departureTime}`);
    const actualStartDate = new Date(ride.rideConfirmation.rideStartedAt);
    
    // Calculate difference in minutes
    const diffMinutes = (actualStartDate - scheduledDate) / (1000 * 60);
    
    // On-time if started within allowed window (-5 min early to +10 min late)
    if (diffMinutes >= -5 && diffMinutes <= ALLOWED_LATE_MINUTES) {
      onTimeCount++;
    }
  }
  
  return Math.round((onTimeCount / completedRides.length) * 100);
}

/**
 * Calculate cancellation rate
 */
async function calculateCancellationRate(driverId) {
  const totalRides = await Ride.countDocuments({ driver: driverId });
  if (totalRides === 0) return 0;
  
  const cancelledRides = await Ride.countDocuments({
    driver: driverId,
    status: "cancelled"
  });
  
  return Math.round((cancelledRides / totalRides) * 100);
}

/**
 * Get average rating from reviews
 */
async function calculateAverageRating(driverId) {
  const reviews = await Review.find({
    reviewee: driverId,
    type: "passenger-reviews-driver"
  }).select("rating");
  
  if (reviews.length === 0) return 5; // Default to perfect if no reviews
  
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  return Math.round((totalRating / reviews.length) * 10) / 10;
}

/**
 * Calculate total reliability score
 */
function calculateTotalScore(metrics) {
  // Normalize ratings to 0-100 scale
  const ratingScore = (metrics.avgRating / 5) * 100;
  
  // Calculate weighted score
  let score = 0;
  score += metrics.completionRate * WEIGHTS.completionRate;
  score += metrics.punctualityRate * WEIGHTS.punctualityRate;
  score += ratingScore * WEIGHTS.avgRating;
  
  // Apply cancellation penalty (subtract from score)
  const cancellationPenalty = metrics.cancellationRate * WEIGHTS.cancellationPenalty;
  score -= cancellationPenalty;
  
  // Clamp between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Convert score to 5-star rating
 */
function scoreToStars(score) {
  return Math.round((score / 100) * 5 * 10) / 10;
}

/**
 * Calculate and update driver reliability score
 * @param {String} driverId - MongoDB ObjectId of driver
 * @returns {Object} - Reliability metrics
 */
async function calculateReliabilityScore(driverId) {
  const completionRate = await calculateCompletionRate(driverId);
  const punctualityRate = await calculatePunctualityRate(driverId);
  const cancellationRate = await calculateCancellationRate(driverId);
  const avgRating = await calculateAverageRating(driverId);
  
  const reviews = await Review.countDocuments({
    reviewee: driverId,
    revieweeType: "driver"
  });
  
  const score = calculateTotalScore({
    completionRate,
    punctualityRate,
    cancellationRate,
    avgRating
  });
  
  const reliabilityMetrics = {
    score,
    completionRate,
    punctualityRate,
    cancellationRate,
    totalRatings: reviews,
    avgRating,
    lastCalculatedAt: new Date()
  };
  
  // Update user's reliability score in database
  await User.findByIdAndUpdate(driverId, {
    reliabilityScore: reliabilityMetrics
  });
  
  return {
    ...reliabilityMetrics,
    stars: scoreToStars(score)
  };
}

/**
 * Get reliability score for a driver (cached or calculated)
 * @param {String} driverId - MongoDB ObjectId of driver
 * @param {Boolean} forceRecalculate - Force fresh calculation
 * @returns {Object} - Reliability metrics
 */
async function getReliabilityScore(driverId, forceRecalculate = false) {
  const user = await User.findById(driverId).select("reliabilityScore");
  
  if (!user) {
    throw new Error("User not found");
  }
  
  const lastCalculated = user.reliabilityScore?.lastCalculatedAt;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Return cached if recent enough
  if (!forceRecalculate && lastCalculated && lastCalculated > oneHourAgo) {
    return {
      ...user.reliabilityScore.toObject(),
      stars: scoreToStars(user.reliabilityScore.score)
    };
  }
  
  // Recalculate
  return calculateReliabilityScore(driverId);
}

/**
 * Batch update reliability scores for multiple drivers
 */
async function batchUpdateReliabilityScores(driverIds) {
  const results = [];
  
  for (const driverId of driverIds) {
    try {
      const result = await calculateReliabilityScore(driverId);
      results.push({ driverId, success: true, ...result });
    } catch (error) {
      results.push({ driverId, success: false, error: error.message });
    }
  }
  
  return results;
}

module.exports = {
  calculateReliabilityScore,
  getReliabilityScore,
  batchUpdateReliabilityScores,
  scoreToStars,
  WEIGHTS
};
