/**
 * Recurring Rides Routes
 * 
 * API endpoints for managing recurring/scheduled rides
 */

const express = require("express");
const RecurringRide = require("../models/RecurringRide");
const Ride = require("../models/Ride");
const { protect } = require("../middleware/auth");
const { sendNotification, NotificationTypes } = require("../utils/notificationQueue");

const router = express.Router();

/**
 * Create a recurring ride schedule
 * POST /api/recurring-rides
 */
router.post("/", protect, async (req, res) => {
  try {
    const {
      role,
      template,
      recurrence,
      startDate,
      endDate,
      skipDates,
      notifications
    } = req.body;

    // Validate required fields
    if (!template?.from || !template?.to || !template?.departureTime) {
      return res.status(400).json({ message: "Missing required template fields" });
    }

    if (!recurrence?.type) {
      return res.status(400).json({ message: "Recurrence type is required" });
    }

    // For weekly/custom, days are required
    if ((recurrence.type === "weekly" || recurrence.type === "custom") && 
        (!recurrence.daysOfWeek || recurrence.daysOfWeek.length === 0)) {
      return res.status(400).json({ message: "Days of week required for weekly/custom recurrence" });
    }

    // Create recurring ride
    const recurringRide = await RecurringRide.create({
      user: req.user._id,
      role: role || "driver",
      template,
      recurrence: {
        type: recurrence.type,
        daysOfWeek: recurrence.daysOfWeek || [],
        advanceBookingDays: recurrence.advanceBookingDays || 7
      },
      startDate: new Date(startDate || Date.now()),
      endDate: endDate ? new Date(endDate) : null,
      skipDates: skipDates?.map(d => new Date(d)) || [],
      notifications: notifications || {}
    });

    // Generate initial rides
    const generatedRides = await generateRidesForRecurring(recurringRide, req.user);

    res.status(201).json({
      recurringRide,
      generatedRides: generatedRides.length,
      message: `Recurring ride created. ${generatedRides.length} rides scheduled.`
    });
  } catch (error) {
    console.error("Create recurring ride error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's recurring rides
 * GET /api/recurring-rides
 */
router.get("/", protect, async (req, res) => {
  try {
    const { status } = req.query;
    
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const recurringRides = await RecurringRide.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Add next occurrence info
    const enriched = recurringRides.map(rr => {
      const upcoming = new RecurringRide(rr).getUpcomingDates(7);
      return {
        ...rr,
        nextOccurrence: upcoming[0] || null,
        upcomingCount: upcoming.length
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get specific recurring ride with generated rides
 * GET /api/recurring-rides/:id
 */
router.get("/:id", protect, async (req, res) => {
  try {
    const recurringRide = await RecurringRide.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate({
      path: "generatedRides.ride",
      select: "date departureTime status from to"
    });

    if (!recurringRide) {
      return res.status(404).json({ message: "Recurring ride not found" });
    }

    res.json(recurringRide);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update recurring ride
 * PUT /api/recurring-rides/:id
 */
router.put("/:id", protect, async (req, res) => {
  try {
    const { template, recurrence, endDate, skipDates, notifications, status } = req.body;

    const recurringRide = await RecurringRide.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!recurringRide) {
      return res.status(404).json({ message: "Recurring ride not found" });
    }

    // Update fields
    if (template) {
      recurringRide.template = { ...recurringRide.template, ...template };
    }
    if (recurrence) {
      recurringRide.recurrence = { ...recurringRide.recurrence, ...recurrence };
    }
    if (endDate !== undefined) {
      recurringRide.endDate = endDate ? new Date(endDate) : null;
    }
    if (skipDates) {
      recurringRide.skipDates = skipDates.map(d => new Date(d));
    }
    if (notifications) {
      recurringRide.notifications = { ...recurringRide.notifications, ...notifications };
    }
    if (status) {
      recurringRide.status = status;
    }

    await recurringRide.save();

    res.json({ recurringRide, message: "Recurring ride updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Pause/Resume recurring ride
 * POST /api/recurring-rides/:id/toggle
 */
router.post("/:id/toggle", protect, async (req, res) => {
  try {
    const recurringRide = await RecurringRide.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!recurringRide) {
      return res.status(404).json({ message: "Recurring ride not found" });
    }

    recurringRide.status = recurringRide.status === "active" ? "paused" : "active";
    await recurringRide.save();

    res.json({ 
      status: recurringRide.status,
      message: `Recurring ride ${recurringRide.status}` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Skip a specific date
 * POST /api/recurring-rides/:id/skip
 */
router.post("/:id/skip", protect, async (req, res) => {
  try {
    const { date } = req.body;

    const recurringRide = await RecurringRide.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!recurringRide) {
      return res.status(404).json({ message: "Recurring ride not found" });
    }

    const skipDate = new Date(date);
    skipDate.setHours(0, 0, 0, 0);

    // Add to skip dates if not already there
    const alreadySkipped = recurringRide.skipDates.some(d => {
      const existing = new Date(d);
      existing.setHours(0, 0, 0, 0);
      return existing.getTime() === skipDate.getTime();
    });

    if (!alreadySkipped) {
      recurringRide.skipDates.push(skipDate);
      
      // Cancel any generated ride for this date
      const generatedForDate = recurringRide.generatedRides.find(gr => {
        const grDate = new Date(gr.date);
        grDate.setHours(0, 0, 0, 0);
        return grDate.getTime() === skipDate.getTime();
      });

      if (generatedForDate && generatedForDate.ride) {
        await Ride.findByIdAndUpdate(generatedForDate.ride, { status: "cancelled" });
        generatedForDate.status = "skipped";
      }

      await recurringRide.save();
    }

    res.json({ message: `Date ${date} will be skipped` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete recurring ride
 * DELETE /api/recurring-rides/:id
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const { cancelFutureRides } = req.query;

    const recurringRide = await RecurringRide.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!recurringRide) {
      return res.status(404).json({ message: "Recurring ride not found" });
    }

    // Optionally cancel future generated rides
    if (cancelFutureRides === "true") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const gr of recurringRide.generatedRides) {
        if (new Date(gr.date) >= today && gr.ride) {
          await Ride.findByIdAndUpdate(gr.ride, { status: "cancelled" });
        }
      }
    }

    recurringRide.status = "cancelled";
    await recurringRide.save();

    res.json({ message: "Recurring ride cancelled" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually trigger ride generation (admin/cron)
 * POST /api/recurring-rides/generate
 */
router.post("/generate", protect, async (req, res) => {
  try {
    const needsGeneration = await RecurringRide.getRecurringRidesNeedingGeneration();
    
    let totalCreated = 0;
    const results = [];

    for (const { recurring, datesToCreate } of needsGeneration) {
      // Only process user's own recurring rides unless admin
      if (recurring.user._id.toString() !== req.user._id.toString()) {
        continue;
      }

      const generated = await generateRidesForRecurring(recurring, recurring.user);
      totalCreated += generated.length;
      results.push({
        recurringId: recurring._id,
        ridesCreated: generated.length
      });
    }

    res.json({ 
      totalCreated,
      results,
      message: `Generated ${totalCreated} rides` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Generate rides for a recurring schedule
 */
async function generateRidesForRecurring(recurringRide, user) {
  const datesToCreate = recurringRide.getUpcomingDates();
  const generatedRides = [];

  for (const date of datesToCreate) {
    try {
      // Format date for ride
      const dateStr = date.toISOString().split("T")[0];

      // Create ride from template
      const rideData = {
        driver: recurringRide.role === "driver" ? user._id : null,
        from: recurringRide.template.from,
        to: recurringRide.template.to,
        date: dateStr,
        departureTime: recurringRide.template.departureTime,
        seats: recurringRide.template.seats || 3,
        availableSeats: recurringRide.template.seats || 3,
        price: recurringRide.template.price,
        vehicleType: recurringRide.template.vehicleType,
        musicPreference: recurringRide.template.preferences?.music,
        conversationPreference: recurringRide.template.preferences?.conversation,
        smokingAllowed: recurringRide.template.preferences?.smoking,
        petsAllowed: recurringRide.template.preferences?.petsAllowed,
        genderPreference: recurringRide.template.preferences?.genderPreference,
        isRecurring: true,
        recurringRideId: recurringRide._id,
        status: "scheduled"
      };

      const ride = await Ride.create(rideData);

      // Track generated ride
      recurringRide.generatedRides.push({
        ride: ride._id,
        date,
        status: "created"
      });

      recurringRide.stats.totalRidesCreated += 1;
      generatedRides.push(ride);

      // Send notification if enabled
      if (recurringRide.notifications.onCreation) {
        await sendNotification(
          user._id,
          "Recurring Ride Created 🔄",
          `Your ${recurringRide.template.from.name} → ${recurringRide.template.to.name} ride for ${dateStr} has been scheduled.`,
          NotificationTypes.RIDE_UPDATE
        );
      }
    } catch (err) {
      console.error(`Failed to create ride for ${date}:`, err);
    }
  }

  recurringRide.lastGeneratedDate = new Date();
  await recurringRide.save();

  return generatedRides;
}

module.exports = router;
