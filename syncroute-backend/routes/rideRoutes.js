const express = require("express");
const axios = require("axios");
const Ride = require("../models/Ride");
const User = require("../models/User");
const { getDistance } = require("geolib");
const { protect, optionalAuth } = require("../middleware/auth");
const { 
  closestRoutePoint, 
  segmentDistance, 
  calculateRouteOverlap,
  calculateMatchScore,
  WALKABLE_DISTANCE_M,
  MIN_OVERLAP_PERCENTAGE,
  FALLBACK_MATCH_DISTANCE_M
} = require("../utils/rideMatchUtils");
const { trackRideView, trackSearch, trackRideCreated } = require("../utils/behaviorTracker");
const { scoreAndRankRides } = require("../utils/personalizedScorer");
const { analyzeUserPreferences } = require("../utils/preferenceAnalyzer");

const router = express.Router();

/**
 * Helper: Check if a ride is still available for booking/display
 * A ride is available if:
 * - Status is "active" (not started, completed, or cancelled)
 * - Ride date/time is at least 3 hours in the future OR ride hasn't started yet
 */
function isRideAvailable(ride) {
  if (ride.status !== "active") return false;
  
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  
  // Parse ride date and time
  const rideDate = ride.date;
  const rideTime = ride.departureTime || "00:00";
  
  // Build ride datetime
  const [hours, minutes] = rideTime.split(":").map(Number);
  const rideDateTime = new Date(rideDate);
  rideDateTime.setHours(hours, minutes, 0, 0);
  
  // Ride must be at least 3 hours from now to be shown
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  // If ride datetime is before 3 hours from now, it's no longer available
  if (rideDateTime < threeHoursFromNow) {
    return false;
  }
  
  return true;
}

/**
 * Helper: Parse date string (YYYY-MM-DD) and time string (HH:MM) into a Date object
 */
function parseRideDateTime(dateStr, timeStr) {
  const [hours, minutes] = (timeStr || "00:00").split(":").map(Number);
  const dateTime = new Date(dateStr);
  dateTime.setHours(hours, minutes, 0, 0);
  return dateTime;
}

/*
========================
CREATE RIDE
========================
*/
router.post("/create", protect, async (req, res) => {
  try {
    const {
      fromLat, fromLng, fromName,
      toLat, toLng, toName,
      departureTime, date, price,
      totalSeats, vehicleType, vehicleModel,
      instantBooking, genderPreference, stops,
      musicPreference, conversationStyle, smokingAllowed, sharedDriving,
      routeCoords, estimatedDuration, estimatedDistance,
      requiresCoDriver,
    } = req.body;

    if (!fromLat || !fromLng || !toLat || !toLng || !departureTime || !date || !price || !totalSeats) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate that the ride date/time is in the future
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const rideDateTime = parseRideDateTime(date, departureTime);
    
    // Ride must be at least for current time if today, or any time if future date
    if (date < today) {
      return res.status(400).json({ message: "Cannot create rides for past dates" });
    }
    
    if (date === today && rideDateTime <= now) {
      return res.status(400).json({ message: "Ride time must be in the future" });
    }

    // Check if user has completed driver verification
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isDriverVerified = user.driverVerification?.isVerified === true;
    if (!isDriverVerified) {
      return res.status(403).json({ 
        message: "Driver verification required to create a ride. Please complete your driver verification first.",
        code: "DRIVER_VERIFICATION_REQUIRED",
        verificationStatus: {
          isVerified: false,
          drivingLicenseVerified: user.driverVerification?.drivingLicenseVerified || false,
          vehicleRegistrationVerified: user.driverVerification?.vehicleRegistrationVerified || false,
        }
      });
    }

    let routePath, osrmDuration, osrmDistance;

    if (routeCoords && Array.isArray(routeCoords) && routeCoords.length > 1) {
      routePath     = { type: "LineString", coordinates: routeCoords };
      osrmDuration  = estimatedDuration || undefined;
      osrmDistance  = estimatedDistance || undefined;
    } else {
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const response = await require("axios").get(osrmUrl);
      if (!response.data.routes?.length) {
        return res.status(400).json({ message: "Route not found" });
      }
      routePath    = { type: "LineString", coordinates: response.data.routes[0].geometry.coordinates };
      osrmDuration = response.data.routes[0].duration;
      osrmDistance = response.data.routes[0].distance;
    }

    const ride = await Ride.create({
      driver: req.user._id,
      from: { name: fromName || "Start", location: { type: "Point", coordinates: [fromLng, fromLat] } },
      to:   { name: toName   || "End",   location: { type: "Point", coordinates: [toLng,   toLat  ] } },
      routePath, departureTime, date, price,
      availableSeats: totalSeats, totalSeats,
      vehicleType: vehicleType || "Sedan", vehicleModel,
      instantBooking: instantBooking !== false,
      genderPreference: genderPreference || "any",
      stops: stops || [],
      musicPreference: musicPreference || "any",
      conversationStyle: conversationStyle || "flexible",
      smokingAllowed: smokingAllowed === true,
      sharedDriving: sharedDriving === true,
      requiresCoDriver: requiresCoDriver === true,
      estimatedDuration: osrmDuration || undefined,
      estimatedDistance: osrmDistance || undefined,
    });

    const populatedRide = await Ride.findById(ride._id).populate("driver", "-password");
    
    // Track ride creation for driver preference learning (async)
    trackRideCreated(req.user._id, populatedRide);
    
    res.status(201).json(populatedRide);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


/*
========================
SMART SEARCH - Route Overlap Matching with Personalization
========================
*/

router.post("/search", optionalAuth, async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, date, passengers, fromName, toName } = req.body;
    const userId = req.user?._id;

    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({ message: "Pickup and drop coordinates required" });
    }

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropLat);
    const dLng = parseFloat(dropLng);

    // Only show active rides with future dates (not completed/past)
    const today = new Date().toISOString().split("T")[0];
    const query = { 
      status: "active",
      date: date ? date : { $gte: today }  // Filter to specific date or future dates
    };
    if (date && date < today) {
      // If searching for past date, return empty
      return res.json({ rides: [], meta: { total: 0, recommended: 0, isPersonalized: false } });
    }
    if (passengers) query.availableSeats = { $gte: parseInt(passengers) };

    const rides = await Ride.find(query).populate("driver", "-password");
    console.log(`[SEARCH] pickup(${pLat},${pLng}) drop(${dLat},${dLng}) rides:${rides.length}, user:${userId || 'anonymous'}`);

    const matched = [];

    for (const ride of rides) {
      // Apply time-based filtering: skip rides that are less than 3 hours away
      if (!isRideAvailable(ride)) {
        console.log(`    [SKIP] Ride ${ride._id} not available (past or within 3 hours)`);
        continue;
      }
      
      const fromCoords  = ride.from?.location?.coordinates;
      const toCoords    = ride.to?.location?.coordinates;
      const routeCoords = ride.routePath?.coordinates;

      // Debug: Log ride info
      console.log(`  Checking ride: ${ride.from?.name} -> ${ride.to?.name} (date: ${ride.date})`);

      if (!fromCoords || fromCoords.length < 2) {
        console.log(`    [SKIP] No from coordinates`);
        continue;
      }
      if (!toCoords || toCoords.length < 2) {
        console.log(`    [SKIP] No to coordinates`);
        continue;
      }

      let matchResult;

      // Use advanced route overlap matching if route has coordinate points
      if (routeCoords && routeCoords.length >= 2) {
        // Calculate comprehensive route overlap analysis
        const overlapAnalysis = calculateRouteOverlap(routeCoords, pLat, pLng, dLat, dLng);
        
        console.log(`    Route has ${routeCoords.length} points. Analysis:`, {
          isValid: overlapAnalysis.isValid,
          overlapPercentage: overlapAnalysis.overlapPercentage,
          pickupDistM: Math.round(overlapAnalysis.pickupDistM || 0),
          dropDistM: Math.round(overlapAnalysis.dropDistM || 0),
          reason: overlapAnalysis.reason
        });

        // Only include if overlap analysis passes all checks
        if (!overlapAnalysis.isValid) {
          console.log(`    [SKIP] ${overlapAnalysis.reason}`);
          continue;
        }

        // Calculate match score for ranking
        const matchScore = calculateMatchScore(overlapAnalysis);

        matchResult = {
          ...ride.toObject(),
          pickupDistanceMeters: overlapAnalysis.pickupDistM,
          dropDistanceMeters: overlapAnalysis.dropDistM,
          overlapDistanceMeters: overlapAnalysis.overlapDistM,
          overlapPercentage: overlapAnalysis.overlapPercentage,
          passengerDirectDistance: overlapAnalysis.passengerDirectM,
          totalRouteDistance: overlapAnalysis.totalRouteM,
          walkingToPickupMinutes: overlapAnalysis.walkingToPickupMinutes,
          walkingFromDropMinutes: overlapAnalysis.walkingFromDropMinutes,
          matchScore,
          matchQuality: overlapAnalysis.overlapPercentage >= 80 ? 'excellent' : 
                        overlapAnalysis.overlapPercentage >= 70 ? 'good' : 'fair'
        };

        console.log(`  [MATCH] ${ride.from?.name} -> ${ride.to?.name} | overlap ${overlapAnalysis.overlapPercentage}% | score ${matchScore}`);
      } else {
        console.log(`    No route path, using fallback endpoint matching`);
        // Fallback: Match if user's pickup/drop are near the ride's from/to endpoints
        // Use stricter threshold for fallback
        const pickupDistM = getDistance(
          { latitude: fromCoords[1], longitude: fromCoords[0] },
          { latitude: pLat, longitude: pLng }
        );
        const dropDistM = getDistance(
          { latitude: toCoords[1], longitude: toCoords[0] },
          { latitude: dLat, longitude: dLng }
        );
        
        console.log(`    Fallback distances: pickup ${Math.round(pickupDistM)}m, drop ${Math.round(dropDistM)}m (max ${FALLBACK_MATCH_DISTANCE_M}m)`);
        
        if (pickupDistM > FALLBACK_MATCH_DISTANCE_M || dropDistM > FALLBACK_MATCH_DISTANCE_M) {
          console.log(`    [SKIP] Too far from endpoints`);
          continue;
        }
        
        // For fallback, estimate overlap based on endpoint proximity
        const maxDist = Math.max(pickupDistM, dropDistM);
        const estimatedOverlap = Math.round(Math.max(0, 100 - (maxDist / FALLBACK_MATCH_DISTANCE_M * 40)));
        
        // Only match if estimated overlap meets threshold
        if (estimatedOverlap < MIN_OVERLAP_PERCENTAGE) {
          console.log(`    [SKIP] Fallback overlap too low (${estimatedOverlap}% < ${MIN_OVERLAP_PERCENTAGE}%)`);
          continue;
        }

        matchResult = {
          ...ride.toObject(),
          pickupDistanceMeters: pickupDistM,
          dropDistanceMeters: dropDistM,
          overlapPercentage: estimatedOverlap,
          walkingToPickupMinutes: Math.round(pickupDistM / 80),
          walkingFromDropMinutes: Math.round(dropDistM / 80),
          matchScore: Math.round(estimatedOverlap * 0.8), // Lower score for fallback matches
          matchQuality: estimatedOverlap >= 80 ? 'good' : 'fair',
          isFallbackMatch: true
        };

        console.log(`  [MATCH-FALLBACK] ${ride.from?.name} -> ${ride.to?.name} | estimated overlap ${estimatedOverlap}%`);
      }

      matched.push(matchResult);
    }

    console.log(`[SEARCH] matched: ${matched.length}/${rides.length}`);

    // Sort matches by score (best first)
    matched.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    // Apply personalization if user is logged in
    let personalizedRides = matched;
    let isPersonalized = false;
    let recommendedCount = 0;

    if (userId) {
      try {
        // Track search behavior (async, don't block response)
        trackSearch(userId, {
          pickupLat: pLat,
          pickupLng: pLng,
          dropLat: dLat,
          dropLng: dLng,
          date,
          passengers: passengers || 1,
          fromName,
          toName
        }, matched.length, {});

        // Ensure user has a preference profile (trigger analysis if needed)
        // This ensures first-time users get personalization started
        analyzeUserPreferences(userId, false).catch(err => {
          console.warn(`[SEARCH] Profile analysis failed for ${userId}:`, err.message);
        });

        // Apply personalized scoring and ranking
        const searchCoords = { pickupLat: pLat, pickupLng: pLng, dropLat: dLat, dropLng: dLng };
        personalizedRides = await scoreAndRankRides(matched, userId, searchCoords);
        
        isPersonalized = personalizedRides.some(r => r.personalization?.isPersonalized);
        recommendedCount = personalizedRides.filter(r => r.personalization?.isRecommended).length;
        
        console.log(`[SEARCH] Personalized: ${isPersonalized}, Recommended: ${recommendedCount}/${personalizedRides.length}`);
      } catch (err) {
        console.warn(`[SEARCH] Personalization failed, returning unpersonalized results:`, err.message);
        // If personalization fails, still return matched rides without personalization
        personalizedRides = matched.map(ride => ({
          ...ride,
          personalization: {
            score: 0.5,
            isPersonalized: false,
            isRecommended: false,
            reasons: []
          }
        }));
      }
    } else {
      // No user logged in - add default personalization structure
      personalizedRides = matched.map(ride => ({
        ...ride,
        personalization: {
          score: 0.5,
          isPersonalized: false,
          isRecommended: false,
          reasons: []
        }
      }));
    }

    // Return response with personalization metadata
    res.json({
      rides: personalizedRides,
      meta: {
        total: personalizedRides.length,
        recommended: recommendedCount,
        isPersonalized
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/all", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rides = await Ride.find({ status: "active", date: { $gte: today } })
      .populate("driver", "-password")
      .sort({ date: 1, departureTime: 1 });
    
    // Filter rides based on 3-hour availability window
    const availableRides = rides.filter(ride => isRideAvailable(ride));
    
    res.json(availableRides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate("driver", "-password");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    
    // Track ride view for logged-in users (async, don't await)
    if (req.user) {
      trackRideView(req.user._id, ride);
    }
    
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/driver/my-rides", protect, async (req, res) => {
  try {
    const rides = await Ride.find({ driver: req.user._id })
      .populate("driver", "-password")
      .sort({ createdAt: -1 });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/*
========================
CHECK FOR CONFLICTING RIDES (Part 3: Duplicate Warning)
========================
*/
router.post("/check-conflict", protect, async (req, res) => {
  try {
    const { date, departureTime } = req.body;
    
    if (!date || !departureTime) {
      return res.status(400).json({ message: "Date and departure time required" });
    }
    
    // Find driver's existing rides on the same date
    const existingRides = await Ride.find({
      driver: req.user._id,
      date: date,
      status: { $in: ["active", "in-progress"] }
    }).select("departureTime from to date");
    
    if (existingRides.length === 0) {
      return res.json({ hasConflict: false, conflictingRides: [] });
    }
    
    // Parse the proposed time
    const [propHours, propMinutes] = departureTime.split(":").map(Number);
    const proposedMinutes = propHours * 60 + propMinutes;
    
    // Check for rides within ±60 minutes
    const conflictingRides = existingRides.filter(ride => {
      const [rideHours, rideMinutes] = (ride.departureTime || "00:00").split(":").map(Number);
      const rideTimeMinutes = rideHours * 60 + rideMinutes;
      const timeDiff = Math.abs(proposedMinutes - rideTimeMinutes);
      return timeDiff <= 60; // Within 60 minutes
    });
    
    res.json({
      hasConflict: conflictingRides.length > 0,
      conflictingRides: conflictingRides.map(r => ({
        _id: r._id,
        departureTime: r.departureTime,
        from: r.from?.name,
        to: r.to?.name,
        date: r.date
      }))
    });
  } catch (error) {
    console.error("Check conflict error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id", protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const updatedRide = await Ride.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    ).populate("driver", "-password");
    res.json(updatedRide);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await ride.deleteOne();
    res.json({ message: "Ride deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/*
========================
RIDE CONFIRMATION FLOW
========================
*/

// Driver confirms ride start
router.post("/:id/confirm-start/driver", protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only driver can confirm" });
    }
    
    if (ride.status !== "active") {
      return res.status(400).json({ message: "Ride cannot be started" });
    }
    
    // Check if it's the ride date
    const today = new Date().toISOString().split("T")[0];
    if (ride.date !== today) {
      return res.status(400).json({ message: "Can only confirm on ride date" });
    }
    
    ride.rideConfirmation = ride.rideConfirmation || {};
    ride.rideConfirmation.driverConfirmed = true;
    ride.rideConfirmation.driverConfirmedAt = new Date();
    
    // Check if any passenger already confirmed
    const hasPassengerConfirmation = ride.rideConfirmation.passengerConfirmations?.length > 0;
    
    if (hasPassengerConfirmation) {
      ride.status = "in-progress";
      ride.rideConfirmation.rideStartedAt = new Date();
      
      // Enable deviation monitoring
      ride.deviationTracking = {
        isMonitored: true,
        lastKnownLocation: null,
        deviationCount: 0
      };
    }
    
    await ride.save();
    
    // Notify passengers
    const Booking = require("../models/Booking");
    const Notification = require("../models/Notification");
    const bookings = await Booking.find({
      ride: ride._id,
      status: { $in: ["confirmed", "pending"] }
    });
    
    const io = req.app.get("io");
    for (const booking of bookings) {
      const notif = await Notification.create({
        user: booking.passenger,
        type: "ride_confirmed",
        title: ride.status === "in-progress" ? "Ride has started!" : "Driver is ready",
        message: ride.status === "in-progress" 
          ? "Your ride has officially started. Have a safe trip!"
          : "Driver has confirmed. Please confirm when ready.",
        data: { rideId: ride._id }
      });
      io.to(`user:${booking.passenger}`).emit("notification", notif);
    }
    
    res.json({
      message: ride.status === "in-progress" ? "Ride started" : "Driver confirmation recorded",
      rideStatus: ride.status,
      rideConfirmation: ride.rideConfirmation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Passenger confirms ride start
router.post("/:id/confirm-start/passenger", protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    
    const Booking = require("../models/Booking");
    const booking = await Booking.findOne({
      _id: bookingId,
      ride: ride._id,
      passenger: req.user._id,
      status: { $in: ["confirmed", "pending"] }
    });
    
    if (!booking) {
      return res.status(403).json({ message: "Booking not found or not authorized" });
    }
    
    if (ride.status !== "active") {
      return res.status(400).json({ message: "Ride cannot be started" });
    }
    
    // Check if it's the ride date
    const today = new Date().toISOString().split("T")[0];
    if (ride.date !== today) {
      return res.status(400).json({ message: "Can only confirm on ride date" });
    }
    
    // Update booking
    booking.rideStartConfirmed = true;
    booking.rideStartConfirmedAt = new Date();
    await booking.save();
    
    // Add to ride confirmations
    ride.rideConfirmation = ride.rideConfirmation || {};
    ride.rideConfirmation.passengerConfirmations = ride.rideConfirmation.passengerConfirmations || [];
    
    // Check if already confirmed
    const alreadyConfirmed = ride.rideConfirmation.passengerConfirmations.find(
      c => c.booking.toString() === bookingId
    );
    
    if (!alreadyConfirmed) {
      ride.rideConfirmation.passengerConfirmations.push({
        booking: booking._id,
        passenger: req.user._id,
        confirmedAt: new Date()
      });
    }
    
    // Check if driver already confirmed
    if (ride.rideConfirmation.driverConfirmed) {
      ride.status = "in-progress";
      ride.rideConfirmation.rideStartedAt = new Date();
      
      // Enable deviation monitoring
      ride.deviationTracking = {
        isMonitored: true,
        lastKnownLocation: null,
        deviationCount: 0
      };
    }
    
    await ride.save();
    
    // Notify driver
    const Notification = require("../models/Notification");
    const io = req.app.get("io");
    const notif = await Notification.create({
      user: ride.driver,
      type: "ride_confirmed",
      title: ride.status === "in-progress" ? "Ride has started!" : "Passenger is ready",
      message: ride.status === "in-progress"
        ? "Ride has officially started. Have a safe trip!"
        : `${req.user.name} has confirmed. Please confirm when ready.`,
      data: { rideId: ride._id }
    });
    io.to(`user:${ride.driver}`).emit("notification", notif);
    
    res.json({
      message: ride.status === "in-progress" ? "Ride started" : "Passenger confirmation recorded",
      rideStatus: ride.status,
      rideConfirmation: ride.rideConfirmation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming rides for user (today or future)
router.get("/upcoming/user", protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const Booking = require("../models/Booking");
    
    // Get rides as driver
    const driverRides = await Ride.find({
      driver: req.user._id,
      date: { $gte: today },
      status: "active"
    })
      .populate("driver", "-password")
      .sort({ date: 1, departureTime: 1 });
    
    // Get rides as passenger
    const passengerBookings = await Booking.find({
      passenger: req.user._id,
      status: { $in: ["confirmed", "pending"] }
    })
      .populate({
        path: "ride",
        match: { date: { $gte: today }, status: "active" },
        populate: { path: "driver", select: "-password" }
      })
      .sort({ createdAt: -1 });
    
    const passengerRides = passengerBookings
      .filter(b => b.ride)
      .map(b => ({
        ...b.ride.toObject(),
        bookingId: b._id,
        bookingStatus: b.status,
        passengerConfirmed: b.rideStartConfirmed
      }));
    
    res.json({
      asDriver: driverRides,
      asPassenger: passengerRides
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ongoing rides for user
router.get("/ongoing/user", protect, async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    
    // Ongoing as driver
    const ongoingAsDriver = await Ride.findOne({
      driver: req.user._id,
      status: "in-progress"
    }).populate("driver", "-password");
    
    // Ongoing as passenger
    const passengerBooking = await Booking.findOne({
      passenger: req.user._id,
      status: { $in: ["confirmed", "pending"] }
    }).populate({
      path: "ride",
      match: { status: "in-progress" },
      populate: { path: "driver", select: "-password" }
    });
    
    res.json({
      asDriver: ongoingAsDriver,
      asPassenger: passengerBooking?.ride ? {
        ...passengerBooking.ride.toObject(),
        bookingId: passengerBooking._id
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete ride (driver marks ride as done)
router.post("/:id/complete", protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only driver can complete ride" });
    }
    
    if (ride.status !== "in-progress") {
      return res.status(400).json({ message: "Ride is not in progress" });
    }
    
    ride.status = "completed";
    if (ride.deviationTracking) {
      ride.deviationTracking.isMonitored = false;
    }
    await ride.save();
    
    // Update all bookings to completed
    const Booking = require("../models/Booking");
    const Notification = require("../models/Notification");
    
    const bookings = await Booking.find({
      ride: ride._id,
      status: { $in: ["confirmed", "pending"] }
    });
    
    const io = req.app.get("io");
    for (const booking of bookings) {
      booking.status = "completed";
      await booking.save();
      
      // Increment trip counts and update rideStats for passenger
      await User.findByIdAndUpdate(booking.passenger, { 
        $inc: { 
          trips: 1,
          "rideStats.totalRidesAsPassenger": 1
        },
        $set: { "rideStats.lastRideDate": new Date() }
      });
      
      // Notify passenger
      const notif = await Notification.create({
        user: booking.passenger,
        type: "ride_completed",
        title: "Ride completed!",
        message: `Your ride from ${ride.from?.name} to ${ride.to?.name} is complete. Leave a review!`,
        data: { rideId: ride._id, bookingId: booking._id }
      });
      io.to(`user:${booking.passenger}`).emit("notification", notif);
    }
    
    // Increment driver trip count and update rideStats
    await User.findByIdAndUpdate(ride.driver, { 
      $inc: { 
        trips: 1,
        "rideStats.totalRidesAsDriver": 1
      },
      $set: { "rideStats.lastRideDate": new Date() }
    });
    
    // Stop all live tracking sessions
    const LiveTracking = require("../models/LiveTracking");
    await LiveTracking.updateMany(
      { ride: ride._id, status: "active" },
      { status: "stopped", stoppedAt: new Date() }
    );
    
    res.json({ message: "Ride completed", ride });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Passenger confirms ride received (Part 10)
router.post("/:id/confirm-received", protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    
    const Booking = require("../models/Booking");
    // Find the booking - allow confirmed, pending, or already completed (for idempotency)
    const booking = await Booking.findOne({
      _id: bookingId,
      ride: ride._id,
      passenger: req.user._id
    });
    
    if (!booking) {
      return res.status(403).json({ message: "Booking not found or not authorized" });
    }
    
    // Check if already completed to avoid double counting
    const alreadyCompleted = booking.status === "completed" && booking.rideReceived === true;
    
    if (alreadyCompleted) {
      // Already completed - just return success without double-counting
      return res.json({
        message: "Ride already confirmed",
        booking: {
          _id: booking._id,
          rideReceived: booking.rideReceived,
          status: booking.status
        }
      });
    }
    
    // Mark booking as received
    booking.rideReceived = true;
    booking.rideReceivedAt = new Date();
    booking.status = "completed";
    await booking.save();
    
    console.log(`[RideComplete] Incrementing trips for passenger ${booking.passenger} and driver ${ride.driver}`);
    
    // Increment trip counts for both passenger and driver
    const passengerUpdate = await User.findByIdAndUpdate(booking.passenger, { 
      $inc: { 
        trips: 1,
        "rideStats.totalRidesAsPassenger": 1
      },
      $set: { "rideStats.lastRideDate": new Date() }
    }, { new: true });
    
    const driverUpdate = await User.findByIdAndUpdate(ride.driver, { 
      $inc: { 
        trips: 1,
        "rideStats.totalRidesAsDriver": 1
      },
      $set: { "rideStats.lastRideDate": new Date() }
    }, { new: true });
    
    console.log(`[RideComplete] Passenger trips: ${passengerUpdate?.trips}, Driver trips: ${driverUpdate?.trips}`);
    
    // Notify driver
    const Notification = require("../models/Notification");
    const io = req.app.get("io");
    
    const notif = await Notification.create({
      user: ride.driver,
      type: "ride_completed",
      title: "Passenger confirmed arrival",
      message: `${req.user.name} has confirmed they received the ride.`,
      data: { rideId: ride._id, bookingId: booking._id }
    });
    io.to(`user:${ride.driver}`).emit("notification", notif);
    
    res.json({
      message: "Ride received confirmed",
      booking: {
        _id: booking._id,
        rideReceived: booking.rideReceived,
        status: booking.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's rides for user (Part 9 - Today Ride Section)
router.get("/today/user", protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const Booking = require("../models/Booking");
    
    // Get today's rides as driver
    const driverRides = await Ride.find({
      driver: req.user._id,
      date: today,
      status: { $in: ["active", "in-progress"] }
    })
      .populate("driver", "-password")
      .sort({ departureTime: 1 });
    
    // Get today's rides as passenger
    const passengerBookings = await Booking.find({
      passenger: req.user._id,
      status: { $in: ["confirmed", "pending"] }
    })
      .populate({
        path: "ride",
        match: { date: today, status: { $in: ["active", "in-progress"] } },
        populate: { path: "driver", select: "-password" }
      })
      .sort({ createdAt: -1 });
    
    const passengerRides = passengerBookings
      .filter(b => b.ride)
      .map(b => ({
        ...b.ride.toObject(),
        _isBooking: true,
        bookingId: b._id,
        bookingStatus: b.status,
        passengerConfirmed: b.rideStartConfirmed,
        rideReceived: b.rideReceived
      }));
    
    res.json({
      asDriver: driverRides,
      asPassenger: passengerRides,
      all: [...driverRides.map(r => ({ ...r.toObject(), _isDriver: true })), ...passengerRides]
        .sort((a, b) => (a.departureTime || "00:00").localeCompare(b.departureTime || "00:00"))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
