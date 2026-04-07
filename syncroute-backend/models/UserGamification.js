/**
 * Gamification Model
 * 
 * Tracks user achievements, badges, streaks, and points
 * for engagement and environmental impact recognition.
 */

const mongoose = require("mongoose");

// Badge definitions
const BADGES = {
  // Milestone badges
  FIRST_RIDE: { id: "first_ride", name: "First Mile", description: "Completed your first ride", icon: "🚗", points: 50, category: "milestone" },
  RIDE_10: { id: "ride_10", name: "Regular Rider", description: "Completed 10 rides", icon: "🎯", points: 100, category: "milestone" },
  RIDE_50: { id: "ride_50", name: "Road Warrior", description: "Completed 50 rides", icon: "⚡", points: 250, category: "milestone" },
  RIDE_100: { id: "ride_100", name: "Centurion", description: "Completed 100 rides", icon: "💯", points: 500, category: "milestone" },
  RIDE_500: { id: "ride_500", name: "Legendary Commuter", description: "Completed 500 rides", icon: "👑", points: 1000, category: "milestone" },

  // Environmental badges
  ECO_STARTER: { id: "eco_starter", name: "Eco Starter", description: "Saved 10kg of CO₂", icon: "🌱", points: 75, category: "environmental" },
  PLANET_PROTECTOR: { id: "planet_protector", name: "Planet Protector", description: "Saved 100kg of CO₂", icon: "🌍", points: 200, category: "environmental" },
  CLIMATE_CHAMPION: { id: "climate_champion", name: "Climate Champion", description: "Saved 500kg of CO₂", icon: "🏆", points: 500, category: "environmental" },
  EARTH_GUARDIAN: { id: "earth_guardian", name: "Earth Guardian", description: "Saved 1 ton of CO₂", icon: "🦸", points: 1000, category: "environmental" },
  TREE_EQUIVALENT: { id: "tree_equivalent", name: "Virtual Forest", description: "Saved CO₂ equivalent to planting 10 trees", icon: "🌳", points: 300, category: "environmental" },

  // Streak badges
  STREAK_7: { id: "streak_7", name: "Week Warrior", description: "7-day carpooling streak", icon: "🔥", points: 150, category: "streak" },
  STREAK_30: { id: "streak_30", name: "Monthly Master", description: "30-day carpooling streak", icon: "💪", points: 400, category: "streak" },
  STREAK_100: { id: "streak_100", name: "Unstoppable", description: "100-day carpooling streak", icon: "⭐", points: 1000, category: "streak" },

  // Social badges
  FIRST_REVIEW: { id: "first_review", name: "Voice Heard", description: "Left your first review", icon: "💬", points: 25, category: "social" },
  HELPFUL_REVIEWER: { id: "helpful_reviewer", name: "Helpful Reviewer", description: "Left 10 reviews", icon: "📝", points: 100, category: "social" },
  COMMUNITY_BUILDER: { id: "community_builder", name: "Community Builder", description: "Referred 5 friends", icon: "🤝", points: 250, category: "social" },

  // Driver badges
  TRUSTED_DRIVER: { id: "trusted_driver", name: "Trusted Driver", description: "Verified driver with 4.5+ rating", icon: "✅", points: 200, category: "driver" },
  SUPER_DRIVER: { id: "super_driver", name: "Super Driver", description: "50 rides with 5-star average", icon: "🌟", points: 500, category: "driver" },
  PUNCTUAL_PRO: { id: "punctual_pro", name: "Punctual Pro", description: "95% on-time departure rate", icon: "⏰", points: 150, category: "driver" },

  // Special badges
  EARLY_ADOPTER: { id: "early_adopter", name: "Early Adopter", description: "Joined in the first month", icon: "🚀", points: 100, category: "special" },
  NIGHT_OWL: { id: "night_owl", name: "Night Owl", description: "10 rides after 10 PM", icon: "🦉", points: 75, category: "special" },
  EARLY_BIRD: { id: "early_bird", name: "Early Bird", description: "10 rides before 7 AM", icon: "🐦", points: 75, category: "special" },
  WEEKEND_WARRIOR: { id: "weekend_warrior", name: "Weekend Warrior", description: "20 weekend rides", icon: "🎉", points: 100, category: "special" }
};

// Levels definition
const LEVELS = [
  { level: 1, name: "Newcomer", minPoints: 0, icon: "🌟" },
  { level: 2, name: "Explorer", minPoints: 100, icon: "🧭" },
  { level: 3, name: "Traveler", minPoints: 300, icon: "🎒" },
  { level: 4, name: "Voyager", minPoints: 600, icon: "🚀" },
  { level: 5, name: "Navigator", minPoints: 1000, icon: "🗺️" },
  { level: 6, name: "Pathfinder", minPoints: 1500, icon: "🔭" },
  { level: 7, name: "Trailblazer", minPoints: 2500, icon: "⚡" },
  { level: 8, name: "Pioneer", minPoints: 4000, icon: "🏅" },
  { level: 9, name: "Champion", minPoints: 6000, icon: "🏆" },
  { level: 10, name: "Legend", minPoints: 10000, icon: "👑" }
];

const UserGamificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  // Points system
  points: {
    total: { type: Number, default: 0 },
    thisWeek: { type: Number, default: 0 },
    thisMonth: { type: Number, default: 0 },
    allTime: { type: Number, default: 0 }
  },

  // Current level
  level: {
    current: { type: Number, default: 1 },
    name: { type: String, default: "Newcomer" },
    icon: { type: String, default: "🌟" },
    progress: { type: Number, default: 0 } // % to next level
  },

  // Earned badges
  badges: [{
    badgeId: String,
    earnedAt: { type: Date, default: Date.now },
    notified: { type: Boolean, default: false }
  }],

  // Streak tracking
  streaks: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastRideDate: Date,
    weeklyGoal: { type: Number, default: 3 }, // rides per week goal
    weeklyProgress: { type: Number, default: 0 }
  },

  // Stats for badge calculations
  stats: {
    totalRides: { type: Number, default: 0 },
    totalCO2Saved: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalReferrals: { type: Number, default: 0 },
    nightRides: { type: Number, default: 0 },
    earlyRides: { type: Number, default: 0 },
    weekendRides: { type: Number, default: 0 },
    perfectRatings: { type: Number, default: 0 }
  },

  // Driver-specific stats for driver badges
  driverStats: {
    isVerified: { type: Boolean, default: false },
    totalRidesAsDriver: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    punctualityRate: { type: Number, default: 0 }
  },

  // User creation date for early adopter badge
  userCreatedAt: { type: Date },

  // Challenges
  activeChallenges: [{
    challengeId: String,
    name: String,
    description: String,
    target: Number,
    progress: Number,
    reward: Number,
    startedAt: Date,
    expiresAt: Date
  }],

  // Recent activity for leaderboard
  lastActivityAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
UserGamificationSchema.index({ "points.total": -1 }); // Leaderboard
UserGamificationSchema.index({ "points.thisWeek": -1 }); // Weekly leaderboard
UserGamificationSchema.index({ "streaks.current": -1 }); // Streak leaderboard

/**
 * Add points and check for level up
 */
UserGamificationSchema.methods.addPoints = async function(amount, reason) {
  this.points.total += amount;
  this.points.thisWeek += amount;
  this.points.thisMonth += amount;
  this.points.allTime += amount;

  // Check for level up
  const newLevel = this.calculateLevel();
  const leveledUp = newLevel.current > this.level.current;
  
  this.level = newLevel;
  await this.save();

  return { leveledUp, newLevel, pointsAdded: amount };
};

/**
 * Calculate current level based on points
 */
UserGamificationSchema.methods.calculateLevel = function() {
  let currentLevel = LEVELS[0];
  
  for (const level of LEVELS) {
    if (this.points.total >= level.minPoints) {
      currentLevel = level;
    } else {
      break;
    }
  }

  // Calculate progress to next level
  const currentIndex = LEVELS.findIndex(l => l.level === currentLevel.level);
  const nextLevel = LEVELS[currentIndex + 1];
  
  let progress = 100;
  if (nextLevel) {
    const pointsInLevel = this.points.total - currentLevel.minPoints;
    const pointsNeeded = nextLevel.minPoints - currentLevel.minPoints;
    progress = Math.min(100, Math.round((pointsInLevel / pointsNeeded) * 100));
  }

  return {
    current: currentLevel.level,
    name: currentLevel.name,
    icon: currentLevel.icon,
    progress,
    nextLevel: nextLevel ? nextLevel.name : null,
    pointsToNext: nextLevel ? nextLevel.minPoints - this.points.total : 0
  };
};

/**
 * Check and award badges
 */
UserGamificationSchema.methods.checkAndAwardBadges = async function() {
  const newBadges = [];
  const earnedIds = this.badges.map(b => b.badgeId);

  // Milestone badges
  if (this.stats.totalRides >= 1 && !earnedIds.includes("first_ride")) {
    newBadges.push(BADGES.FIRST_RIDE);
  }
  if (this.stats.totalRides >= 10 && !earnedIds.includes("ride_10")) {
    newBadges.push(BADGES.RIDE_10);
  }
  if (this.stats.totalRides >= 50 && !earnedIds.includes("ride_50")) {
    newBadges.push(BADGES.RIDE_50);
  }
  if (this.stats.totalRides >= 100 && !earnedIds.includes("ride_100")) {
    newBadges.push(BADGES.RIDE_100);
  }
  if (this.stats.totalRides >= 500 && !earnedIds.includes("ride_500")) {
    newBadges.push(BADGES.RIDE_500);
  }

  // Environmental badges
  if (this.stats.totalCO2Saved >= 10 && !earnedIds.includes("eco_starter")) {
    newBadges.push(BADGES.ECO_STARTER);
  }
  if (this.stats.totalCO2Saved >= 100 && !earnedIds.includes("planet_protector")) {
    newBadges.push(BADGES.PLANET_PROTECTOR);
  }
  if (this.stats.totalCO2Saved >= 500 && !earnedIds.includes("climate_champion")) {
    newBadges.push(BADGES.CLIMATE_CHAMPION);
  }
  if (this.stats.totalCO2Saved >= 1000 && !earnedIds.includes("earth_guardian")) {
    newBadges.push(BADGES.EARTH_GUARDIAN);
  }

  // Streak badges
  if (this.streaks.current >= 7 && !earnedIds.includes("streak_7")) {
    newBadges.push(BADGES.STREAK_7);
  }
  if (this.streaks.current >= 30 && !earnedIds.includes("streak_30")) {
    newBadges.push(BADGES.STREAK_30);
  }
  if (this.streaks.current >= 100 && !earnedIds.includes("streak_100")) {
    newBadges.push(BADGES.STREAK_100);
  }

  // Social badges
  if (this.stats.totalReviews >= 1 && !earnedIds.includes("first_review")) {
    newBadges.push(BADGES.FIRST_REVIEW);
  }
  if (this.stats.totalReviews >= 10 && !earnedIds.includes("helpful_reviewer")) {
    newBadges.push(BADGES.HELPFUL_REVIEWER);
  }
  if (this.stats.totalReferrals >= 5 && !earnedIds.includes("community_builder")) {
    newBadges.push(BADGES.COMMUNITY_BUILDER);
  }

  // Special badges
  if (this.stats.nightRides >= 10 && !earnedIds.includes("night_owl")) {
    newBadges.push(BADGES.NIGHT_OWL);
  }
  if (this.stats.earlyRides >= 10 && !earnedIds.includes("early_bird")) {
    newBadges.push(BADGES.EARLY_BIRD);
  }
  if (this.stats.weekendRides >= 20 && !earnedIds.includes("weekend_warrior")) {
    newBadges.push(BADGES.WEEKEND_WARRIOR);
  }

  // Tree equivalent badge (10 trees = 210 kg CO2 saved, roughly 21kg per tree per year)
  if (this.stats.totalCO2Saved >= 210 && !earnedIds.includes("tree_equivalent")) {
    newBadges.push(BADGES.TREE_EQUIVALENT);
  }

  // Driver badges - require external user data (passed via context or fetched)
  // These need to be checked when driver stats are available
  if (this.driverStats?.isVerified && this.driverStats?.averageRating >= 4.5 && !earnedIds.includes("trusted_driver")) {
    newBadges.push(BADGES.TRUSTED_DRIVER);
  }
  if (this.driverStats?.totalRidesAsDriver >= 50 && this.driverStats?.averageRating >= 5 && !earnedIds.includes("super_driver")) {
    newBadges.push(BADGES.SUPER_DRIVER);
  }
  if (this.driverStats?.punctualityRate >= 95 && !earnedIds.includes("punctual_pro")) {
    newBadges.push(BADGES.PUNCTUAL_PRO);
  }

  // Early adopter (check if user joined within first month - requires user creation date)
  if (this.userCreatedAt) {
    const launchDate = new Date('2024-01-01'); // Platform launch date
    const firstMonthEnd = new Date(launchDate);
    firstMonthEnd.setMonth(firstMonthEnd.getMonth() + 1);
    if (new Date(this.userCreatedAt) <= firstMonthEnd && !earnedIds.includes("early_adopter")) {
      newBadges.push(BADGES.EARLY_ADOPTER);
    }
  }

  // Award new badges
  for (const badge of newBadges) {
    this.badges.push({ badgeId: badge.id, earnedAt: new Date() });
    this.points.total += badge.points;
    this.points.allTime += badge.points;
  }

  if (newBadges.length > 0) {
    this.level = this.calculateLevel();
    await this.save();
  }

  return newBadges;
};

/**
 * Update streak
 */
UserGamificationSchema.methods.updateStreak = async function(rideDate) {
  const today = new Date(rideDate);
  today.setHours(0, 0, 0, 0);

  if (!this.streaks.lastRideDate) {
    // First ride
    this.streaks.current = 1;
    this.streaks.longest = 1;
  } else {
    const lastDate = new Date(this.streaks.lastRideDate);
    lastDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      // Same day, no change
    } else if (daysDiff === 1) {
      // Consecutive day
      this.streaks.current += 1;
      if (this.streaks.current > this.streaks.longest) {
        this.streaks.longest = this.streaks.current;
      }
    } else {
      // Streak broken
      this.streaks.current = 1;
    }
  }

  this.streaks.lastRideDate = today;
  this.streaks.weeklyProgress += 1;
  await this.save();
};

/**
 * Get leaderboard
 */
UserGamificationSchema.statics.getLeaderboard = async function(type = "allTime", limit = 10) {
  const sortField = {
    allTime: "points.allTime",
    weekly: "points.thisWeek",
    monthly: "points.thisMonth",
    streak: "streaks.current"
  }[type] || "points.allTime";

  return this.find({})
    .sort({ [sortField]: -1 })
    .limit(limit)
    .populate("user", "name photo")
    .select("user points level badges streaks");
};

// Export badge definitions for frontend
UserGamificationSchema.statics.BADGES = BADGES;
UserGamificationSchema.statics.LEVELS = LEVELS;

module.exports = mongoose.model("UserGamification", UserGamificationSchema);
