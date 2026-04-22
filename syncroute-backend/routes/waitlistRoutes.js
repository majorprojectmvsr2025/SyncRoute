const express = require("express");
const Waitlist = require("../models/Waitlist");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { trackWaitlistJoined } = require("../utils/behaviorTracker");

const router = express.Router();

// Offer timeout in milliseconds (5 minutes)
const OFFER_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Helper to emit notification via socket
 */
async function emitNotification(req, userId, notifData) {
  const notification = await Notification.create({ user: userId, ...notifData });
  const io = req.app.get("io");
  io.to(`user:${userId}`).emit("notification", notification);
  return notification;
}

/**
 * Join waitlist for a ride
 * POST /api/waitlist/join
 */
router.post("/join", protect, async (req, res) => {
  try {
    const { rideId, seats, pickupLocation, dropLocation } = req.body;
    
    // Verify ride exists
    const ride = await Ride.findById(rideId).populate("driver");
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    
    // Check if user is the driver
    if (ride.driver._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot join waitlist for your own ride" });
    }
    
    // Check if ride is still active
    if (ride.status !== "active") {
      return res.status(400).json({ message: "This ride is no longer accepting bookings" });
    }
    
    // Check if user already has a booking
    const existingBooking = await Booking.findOne({
      ride: rideId,
      passenger: req.user._id,
      status: { $ne: "cancelled" }
    });
    
    if (existingBooking) {
      return res.status(400).json({ message: "You already have a booking for this ride" });
    }
    
    // Check if already on waitlist
    const existingWaitlist = await Waitlist.findOne({
      ride: rideId,
      user: req.user._id,
      status: { $in: ["waiting", "offered"] }
    });
    
    if (existingWaitlist) {
      return res.status(400).json({ 
        message: "You are already on the waitlist",
        position: existingWaitlist.position
      });
    }
    
    // Get next position
    const position = await Waitlist.getNextPosition(rideId);
    
    // Create waitlist entry
    const waitlistEntry = await Waitlist.create({
      ride: rideId,
      user: req.user._id,
      seatsRequested: seats || 1,
      position,
      pickupLocation,
      dropLocation
    });
    
    // Notify driver
    await emitNotification(req, ride.driver._id, {
      type: "waitlist_join",
      title: "New waitlist request",
      message: `${req.user.name} joined the waitlist for your ride`,
      data: { rideId, waitlistId: waitlistEntry._id }
    });
    
    // Track waitlist behavior for PRIE (async, don't await)
    trackWaitlistJoined(req.user._id, ride, seats || 1);
    
    res.status(201).json({
      message: "Added to waitlist",
      position,
      waitlistId: waitlistEntry._id
    });
  } catch (error) {
    console.error("Join waitlist error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get waitlist status for a user
 * GET /api/waitlist/my-status/:rideId
 */
router.get("/my-status/:rideId", protect, async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const entry = await Waitlist.findOne({
      ride: rideId,
      user: req.user._id,
      status: { $in: ["waiting", "offered"] }
    });
    
    if (!entry) {
      return res.json({ onWaitlist: false });
    }
    
    // Get total people ahead
    const aheadCount = await Waitlist.countDocuments({
      ride: rideId,
      position: { $lt: entry.position },
      status: { $in: ["waiting", "offered"] }
    });
    
    res.json({
      onWaitlist: true,
      position: entry.position,
      peopleAhead: aheadCount,
      status: entry.status,
      seatsRequested: entry.seatsRequested,
      offerExpiresAt: entry.offerExpiresAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Leave waitlist
 * DELETE /api/waitlist/:rideId
 */
router.delete("/:rideId", protect, async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const entry = await Waitlist.findOne({
      ride: rideId,
      user: req.user._id,
      status: { $in: ["waiting", "offered"] }
    });
    
    if (!entry) {
      return res.status(404).json({ message: "Not on waitlist" });
    }
    
    await entry.cancel();
    
    res.json({ message: "Removed from waitlist" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Accept waitlist offer
 * POST /api/waitlist/accept/:waitlistId
 */
router.post("/accept/:waitlistId", protect, async (req, res) => {
  try {
    const { waitlistId } = req.params;
    
    const entry = await Waitlist.findById(waitlistId).populate("ride");
    
    if (!entry) {
      return res.status(404).json({ message: "Waitlist entry not found" });
    }
    
    if (entry.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    if (entry.status !== "offered") {
      return res.status(400).json({ message: "No active offer to accept" });
    }
    
    // Check if offer expired
    if (entry.offerExpiresAt < new Date()) {
      entry.status = "expired";
      await entry.save();
      
      // Offer to next person
      await processNextInWaitlist(req, entry.ride._id, entry.seatsRequested);
      
      return res.status(400).json({ message: "Offer has expired" });
    }
    
    // Verify seats still available
    const ride = await Ride.findById(entry.ride._id);
    if (ride.availableSeats < entry.seatsRequested) {
      entry.status = "expired";
      await entry.save();
      return res.status(400).json({ message: "Seats are no longer available" });
    }
    
    // Create booking
    const booking = await Booking.create({
      ride: entry.ride._id,
      passenger: entry.user,
      driver: ride.driver,
      seats: entry.seatsRequested,
      totalPrice: ride.price * entry.seatsRequested,
      pickupLocation: entry.pickupLocation,
      dropLocation: entry.dropLocation,
      status: "confirmed"
    });
    
    // Update ride seats
    ride.availableSeats -= entry.seatsRequested;
    await ride.save();
    
    // Update waitlist entry
    entry.status = "confirmed";
    entry.respondedAt = new Date();
    entry.booking = booking._id;
    await entry.save();
    
    // Notify driver
    await emitNotification(req, ride.driver, {
      type: "booking_confirmed",
      title: "Waitlist booking confirmed",
      message: `${req.user.name} accepted their waitlist offer`,
      data: { bookingId: booking._id, rideId: ride._id }
    });
    
    res.json({
      message: "Booking confirmed",
      booking: await Booking.findById(booking._id)
        .populate("ride")
        .populate("driver", "-password")
    });
  } catch (error) {
    console.error("Accept offer error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Decline waitlist offer
 * POST /api/waitlist/decline/:waitlistId
 */
router.post("/decline/:waitlistId", protect, async (req, res) => {
  try {
    const { waitlistId } = req.params;
    
    const entry = await Waitlist.findById(waitlistId);
    
    if (!entry) {
      return res.status(404).json({ message: "Waitlist entry not found" });
    }
    
    if (entry.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    await entry.declineOffer();
    
    // Offer to next person (use ride._id for consistency)
    const rideId = entry.ride?._id || entry.ride;
    await processNextInWaitlist(req, rideId, entry.seatsRequested);
    
    res.json({ message: "Offer declined" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get waitlist for a ride (driver only)
 * GET /api/waitlist/ride/:rideId
 */
router.get("/ride/:rideId", protect, async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const waitlist = await Waitlist.getWaitlist(rideId);
    
    res.json(waitlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process expired offers and offer to next in line
 * Called periodically or when offers expire
 */
async function processExpiredOffers() {
  const expiredOffers = await Waitlist.find({
    status: "offered",
    offerExpiresAt: { $lt: new Date() }
  });
  
  for (const entry of expiredOffers) {
    entry.status = "expired";
    await entry.save();
    
    // Check if seats still available
    const ride = await Ride.findById(entry.ride);
    if (ride && ride.availableSeats >= entry.seatsRequested) {
      await Waitlist.offerSeatToNext(entry.ride, ride.availableSeats);
    }
  }
  
  return expiredOffers.length;
}

/**
 * Process next person in waitlist
 */
async function processNextInWaitlist(req, rideId, seatsAvailable) {
  const nextEntry = await Waitlist.offerSeatToNext(rideId, seatsAvailable);
  
  if (nextEntry) {
    // Notify user of seat offer
    await emitNotification(req, nextEntry.user, {
      type: "waitlist_offer",
      title: "Seat available!",
      message: `A seat is now available on a ride you're waiting for. Confirm within 5 minutes!`,
      data: { 
        rideId: nextEntry.ride, 
        waitlistId: nextEntry._id,
        expiresAt: nextEntry.offerExpiresAt
      }
    });
  }
  
  return nextEntry;
}

/**
 * Trigger waitlist processing when booking is cancelled
 * POST /api/waitlist/process-cancellation
 */
router.post("/process-cancellation", protect, async (req, res) => {
  try {
    const { rideId, seatsReleased } = req.body;
    
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    
    // Must be driver
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const nextEntry = await processNextInWaitlist(req, rideId, seatsReleased);
    
    res.json({
      message: nextEntry ? "Offered to next in waitlist" : "No one in waitlist",
      offeredTo: nextEntry?.user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export helper for use by booking routes
module.exports = router;
module.exports.processNextInWaitlist = processNextInWaitlist;
module.exports.processExpiredOffers = processExpiredOffers;
