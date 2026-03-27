const express = require("express");
const axios = require("axios");
const Ride = require("../models/Ride");
const User = require("../models/User");
const { getDistance } = require("geolib");
const { protect } = require("../middleware/auth");
const { closestRoutePoint, segmentDistance } = require("../utils/rideMatchUtils");

const router = express.Router();

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
    } = req.body;

    if (!fromLat || !fromLng || !toLat || !toLng || !departureTime || !date || !price || !totalSeats) {
      return res.status(400).json({ message: "Missing required fields" });
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
      estimatedDuration: osrmDuration || undefined,
      estimatedDistance: osrmDistance || undefined,
    });

    const populatedRide = await Ride.findById(ride._id).populate("driver", "-password");
    res.status(201).json(populatedRide);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


/*
========================
SMART SEARCH - Route Overlap Matching
========================
*/

router.post("/search", async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, date, passengers } = req.body;

    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({ message: "Pickup and drop coordinates required" });
    }

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropLat);
    const dLng = parseFloat(dropLng);

    const query = { status: "active" };
    if (date) query.date = date;
    if (passengers) query.availableSeats = { $gte: parseInt(passengers) };

    const rides = await Ride.find(query).populate("driver", "-password");
    console.log(`  SEARCH: pickup(${pLat},${pLng}) drop(${dLat},${dLng}) rides:${rides.length}`);

    const NEAR_ROUTE_M = 3000;
    const FALLBACK_M   = 50000;
    const matched = [];

    for (const ride of rides) {
      const fromCoords  = ride.from?.location?.coordinates;
      const toCoords    = ride.to?.location?.coordinates;
      const routeCoords = ride.routePath?.coordinates;

      if (!fromCoords || fromCoords.length < 2) continue;
      if (!toCoords   || toCoords.length   < 2) continue;

      let pickupDistM, dropDistM, overlapDistM;

      if (routeCoords && routeCoords.length > 3) {
        const pickup = closestRoutePoint(routeCoords, pLat, pLng);
        const drop   = closestRoutePoint(routeCoords, dLat, dLng);

        if (pickup.dist > NEAR_ROUTE_M || drop.dist > NEAR_ROUTE_M) continue;
        if (pickup.idx >= drop.idx) continue;

        let segDist = segmentDistance(routeCoords, pickup.idx, drop.idx);
        pickupDistM  = pickup.dist;
        dropDistM    = drop.dist;
        overlapDistM = segDist;
        console.log(`  [match] ${ride.from?.name} -> ${ride.to?.name} | overlap ${Math.round(segDist/1000)}km`);
      } else {
        pickupDistM = getDistance(
          { latitude: fromCoords[1], longitude: fromCoords[0] },
          { latitude: pLat, longitude: pLng }
        );
        dropDistM = getDistance(
          { latitude: toCoords[1], longitude: toCoords[0] },
          { latitude: dLat, longitude: dLng }
        );
        if (pickupDistM > FALLBACK_M || dropDistM > FALLBACK_M) continue;
        console.log(`  [match-fallback] ${ride.from?.name} -> ${ride.to?.name}`);
      }

      matched.push({
        ...ride.toObject(),
        pickupDistanceMeters:   pickupDistM,
        dropDistanceMeters:     dropDistM,
        overlapDistanceMeters:  overlapDistM,
        walkingToPickupMinutes: Math.round(pickupDistM / 80),
        walkingFromDropMinutes: Math.round(dropDistM   / 80),
      });
    }

    console.log(`  matched: ${matched.length}/${rides.length}`);
    res.json(matched);
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
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate("driver", "-password");
    if (!ride) return res.status(404).json({ message: "Ride not found" });
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

module.exports = router;
