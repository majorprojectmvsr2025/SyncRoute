/**
 * Gamification Routes
 * 
 * API endpoints for badges, levels, streaks, and leaderboards
 */

const express = require("express");
const UserGamification = require("../models/UserGamification");
const { protect } = require("../middleware/auth");
const { sendNotification, NotificationTypes } = require("../utils/notificationQueue");

const router = express.Router();

/**
 * Get user's gamification profile
 * GET /api/gamification/profile
 */
router.get("/profile", protect, async (req, res) => {
  try {
    let gamification = await UserGamification.findOne({ user: req.user._id });

    // Create profile if doesn't exist
    if (!gamification) {
      gamification = await UserGamification.create({ user: req.user._id });
    }

    // Get badge details
    const badgeDetails = gamification.badges.map(b => ({
      ...UserGamification.BADGES[b.badgeId.toUpperCase()],
      earnedAt: b.earnedAt
    })).filter(b => b.id);

    res.json({
      points: gamification.points,
      level: gamification.level,
      badges: badgeDetails,
      streaks: gamification.streaks,
      stats: gamification.stats,
      activeChallenges: gamification.activeChallenges
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all available badges
 * GET /api/gamification/badges
 */
router.get("/badges", protect, async (req, res) => {
  try {
    const gamification = await UserGamification.findOne({ user: req.user._id });
    const earnedIds = gamification?.badges.map(b => b.badgeId) || [];

    // Group badges by category
    const badgesByCategory = {};
    
    for (const [key, badge] of Object.entries(UserGamification.BADGES)) {
      const category = badge.category;
      if (!badgesByCategory[category]) {
        badgesByCategory[category] = [];
      }
      
      badgesByCategory[category].push({
        ...badge,
        earned: earnedIds.includes(badge.id),
        earnedAt: gamification?.badges.find(b => b.badgeId === badge.id)?.earnedAt
      });
    }

    res.json({
      badges: badgesByCategory,
      totalEarned: earnedIds.length,
      totalAvailable: Object.keys(UserGamification.BADGES).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all levels info
 * GET /api/gamification/levels
 */
router.get("/levels", protect, async (req, res) => {
  try {
    const gamification = await UserGamification.findOne({ user: req.user._id });
    const currentLevel = gamification?.level.current || 1;

    const levels = UserGamification.LEVELS.map(level => ({
      ...level,
      achieved: level.level <= currentLevel,
      current: level.level === currentLevel
    }));

    res.json({
      levels,
      currentLevel,
      totalPoints: gamification?.points.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get leaderboard
 * GET /api/gamification/leaderboard
 */
router.get("/leaderboard", protect, async (req, res) => {
  try {
    const { type = "allTime", limit = 10 } = req.query;

    const leaderboard = await UserGamification.getLeaderboard(type, parseInt(limit));

    // Find user's rank
    const userGamification = await UserGamification.findOne({ user: req.user._id });
    let userRank = null;

    if (userGamification) {
      const sortField = {
        allTime: "points.allTime",
        weekly: "points.thisWeek",
        monthly: "points.thisMonth",
        streak: "streaks.current"
      }[type] || "points.allTime";

      const userValue = type === "streak" 
        ? userGamification.streaks.current 
        : userGamification.points[type] || userGamification.points.allTime;

      const higherCount = await UserGamification.countDocuments({
        [sortField]: { $gt: userValue }
      });

      userRank = higherCount + 1;
    }

    // Format leaderboard
    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: {
        _id: entry.user?._id,
        name: entry.user?.name || "Anonymous",
        photo: entry.user?.photo
      },
      points: entry.points,
      level: entry.level,
      streak: entry.streaks?.current || 0,
      badgeCount: entry.badges?.length || 0
    }));

    res.json({
      leaderboard: formattedLeaderboard,
      userRank,
      type
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get streak info
 * GET /api/gamification/streak
 */
router.get("/streak", protect, async (req, res) => {
  try {
    const gamification = await UserGamification.findOne({ user: req.user._id });

    if (!gamification) {
      return res.json({
        current: 0,
        longest: 0,
        lastRideDate: null,
        weeklyGoal: 3,
        weeklyProgress: 0
      });
    }

    // Check if streak is still valid
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streakValid = true;
    if (gamification.streaks.lastRideDate) {
      const lastDate = new Date(gamification.streaks.lastRideDate);
      lastDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 1) {
        streakValid = false;
        gamification.streaks.current = 0;
        await gamification.save();
      }
    }

    res.json({
      ...gamification.streaks,
      streakValid
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record a ride completion (called by ride completion hook)
 * POST /api/gamification/record-ride
 */
router.post("/record-ride", protect, async (req, res) => {
  try {
    const { rideId, co2Saved, departureTime, isWeekend } = req.body;

    let gamification = await UserGamification.findOne({ user: req.user._id });
    
    if (!gamification) {
      gamification = await UserGamification.create({ user: req.user._id });
    }

    // Update stats
    gamification.stats.totalRides += 1;
    gamification.stats.totalCO2Saved += co2Saved || 0;

    // Check ride time
    if (departureTime) {
      const hour = parseInt(departureTime.split(":")[0]);
      if (hour >= 22 || hour < 5) {
        gamification.stats.nightRides += 1;
      }
      if (hour < 7) {
        gamification.stats.earlyRides += 1;
      }
    }

    if (isWeekend) {
      gamification.stats.weekendRides += 1;
    }

    // Update streak
    await gamification.updateStreak(new Date());

    // Add base points for ride
    const basePoints = 10;
    const streakBonus = Math.min(gamification.streaks.current * 2, 20);
    const totalPoints = basePoints + streakBonus;

    await gamification.addPoints(totalPoints, "Ride completed");

    // Check for new badges
    const newBadges = await gamification.checkAndAwardBadges();

    // Notify about new badges
    for (const badge of newBadges) {
      await sendNotification(
        req.user._id,
        `New Badge Earned! ${badge.icon}`,
        `You've earned "${badge.name}" - ${badge.description}. +${badge.points} points!`,
        NotificationTypes.RIDE_UPDATE
      );
    }

    gamification.lastActivityAt = new Date();
    await gamification.save();

    res.json({
      pointsEarned: totalPoints,
      newBadges,
      level: gamification.level,
      streak: gamification.streaks.current
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record a review (for badge tracking)
 * POST /api/gamification/record-review
 */
router.post("/record-review", protect, async (req, res) => {
  try {
    let gamification = await UserGamification.findOne({ user: req.user._id });
    
    if (!gamification) {
      gamification = await UserGamification.create({ user: req.user._id });
    }

    gamification.stats.totalReviews += 1;
    await gamification.addPoints(5, "Review submitted");
    
    const newBadges = await gamification.checkAndAwardBadges();
    await gamification.save();

    res.json({ newBadges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get weekly challenges
 * GET /api/gamification/challenges
 */
router.get("/challenges", protect, async (req, res) => {
  try {
    const gamification = await UserGamification.findOne({ user: req.user._id });

    // Default weekly challenges
    const weeklyGoal = gamification?.streaks.weeklyGoal || 3;
    const weeklyProgress = gamification?.streaks.weeklyProgress || 0;

    const challenges = [
      {
        id: "weekly_rides",
        name: "Weekly Commuter",
        description: `Complete ${weeklyGoal} rides this week`,
        target: weeklyGoal,
        progress: weeklyProgress,
        reward: 50,
        type: "weekly"
      },
      {
        id: "eco_week",
        name: "Eco Week",
        description: "Save 20kg of CO₂ this week",
        target: 20,
        progress: Math.min(20, (gamification?.stats.totalCO2Saved || 0) % 20),
        reward: 75,
        type: "weekly"
      }
    ];

    res.json({ challenges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset weekly stats (cron job endpoint)
 * POST /api/gamification/reset-weekly
 */
router.post("/reset-weekly", protect, async (req, res) => {
  try {
    // This would typically be called by a cron job
    await UserGamification.updateMany(
      {},
      {
        "points.thisWeek": 0,
        "streaks.weeklyProgress": 0
      }
    );

    res.json({ message: "Weekly stats reset" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
