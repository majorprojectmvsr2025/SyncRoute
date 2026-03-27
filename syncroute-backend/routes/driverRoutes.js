const express = require("express");
const Booking = require("../models/Booking");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Get driver earnings and analytics
router.get("/earnings", protect, async (req, res) => {
  try {
    // Monthly breakdown from completed bookings
    const earningsByMonth = await Booking.aggregate([
      {
        $match: {
          driver: req.user._id,
          status: "completed"
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          revenue: { $sum: "$totalPrice" },
          trips: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const totalEarnings = earningsByMonth.reduce((sum, m) => sum + m.revenue, 0);
    const completedTrips = earningsByMonth.reduce((sum, m) => sum + m.trips, 0);
    const avgPerTrip = completedTrips > 0 ? totalEarnings / completedTrips : 0;

    // Pending earnings
    const pendingResult = await Booking.aggregate([
      {
        $match: {
          driver: req.user._id,
          status: { $in: ["confirmed", "pending"] }
        }
      },
      {
        $group: { _id: null, total: { $sum: "$totalPrice" } }
      }
    ]);

    const pendingEarnings = pendingResult[0]?.total || 0;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    res.json({
      totalEarnings,
      pendingEarnings,
      completedTrips,
      avgPerTrip: Math.round(avgPerTrip),
      monthlyBreakdown: earningsByMonth.map(m => ({
        month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
        revenue: m.revenue,
        trips: m.trips
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
