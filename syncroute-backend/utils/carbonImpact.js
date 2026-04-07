/**
 * Carbon Impact Analysis System
 * 
 * Calculates environmental benefits of carpooling:
 * - CO₂ emissions saved
 * - Fuel saved
 * - Money saved
 * - Environmental equivalents
 */

const Booking = require("../models/Booking");
const Ride = require("../models/Ride");
const User = require("../models/User");

// Environmental impact constants
const CARBON_CONFIG = {
  // CO2 emissions per km (grams)
  co2PerKm: {
    solo_petrol: 192,      // Average petrol car
    solo_diesel: 171,      // Average diesel car
    carpool_petrol: 64,    // 3 people sharing (192/3)
    carpool_diesel: 57,    // 3 people sharing
    public_transport: 89,  // Bus/train average
    electric: 50,          // Including grid emissions
    bike: 0
  },
  
  // Fuel consumption (liters per 100km)
  fuelPer100km: {
    petrol: 8.5,
    diesel: 6.5,
    cng: 7.0,
    electric: 0  // kWh instead
  },
  
  // Average fuel prices (₹ per liter)
  fuelPrices: {
    petrol: 105,
    diesel: 90,
    cng: 75
  },
  
  // Environmental equivalents
  equivalents: {
    treesPerKgCO2: 0.046,     // Trees needed to absorb 1kg CO2/year
    drivingPerKgCO2: 5.2,     // km of solo driving per kg CO2
    phoneCharges: 60,         // Phone charges per kg CO2
    lightBulbHours: 45,       // LED bulb hours per kg CO2
    plasticBottles: 20        // Plastic bottles manufactured per kg CO2
  },
  
  // Default carpooling assumptions
  defaults: {
    avgOccupancy: 3,          // Average passengers per carpool
    soloOccupancy: 1.2,       // Average solo car occupancy
    emissionSavingsRate: 0.67  // 67% reduction per passenger vs solo
  }
};

/**
 * Calculate CO2 saved for a single ride
 */
function calculateRideCarbonSavings(distanceKm, passengers = 1, vehicleType = "petrol") {
  // Solo driving emissions
  const soloEmissions = distanceKm * CARBON_CONFIG.co2PerKm[`solo_${vehicleType}`] / 1000; // kg
  
  // Carpool emissions (shared among passengers)
  const carpoolEmissions = soloEmissions / Math.max(1, passengers + 1); // +1 for driver
  
  // Savings = what each passenger would have emitted solo - their carpool share
  const savingsPerPassenger = soloEmissions - carpoolEmissions;
  const totalSavings = savingsPerPassenger * passengers;
  
  return {
    soloEmissionsKg: Math.round(soloEmissions * 100) / 100,
    carpoolEmissionsKg: Math.round(carpoolEmissions * 100) / 100,
    savedPerPassengerKg: Math.round(savingsPerPassenger * 100) / 100,
    totalSavedKg: Math.round(totalSavings * 100) / 100
  };
}

/**
 * Calculate fuel savings
 */
function calculateFuelSavings(distanceKm, passengers = 1, fuelType = "petrol") {
  const fuelPer100 = CARBON_CONFIG.fuelPer100km[fuelType] || CARBON_CONFIG.fuelPer100km.petrol;
  const fuelPrice = CARBON_CONFIG.fuelPrices[fuelType] || CARBON_CONFIG.fuelPrices.petrol;
  
  // Total fuel for the trip
  const tripFuel = (distanceKm / 100) * fuelPer100;
  
  // Solo: each person would use this much
  const soloFuelTotal = tripFuel * passengers;
  
  // Carpool: only one car used
  const carpoolFuel = tripFuel;
  
  // Savings
  const fuelSaved = soloFuelTotal - carpoolFuel;
  const moneySaved = fuelSaved * fuelPrice;
  
  return {
    tripFuelLiters: Math.round(tripFuel * 100) / 100,
    fuelSavedLiters: Math.round(fuelSaved * 100) / 100,
    moneySavedRupees: Math.round(moneySaved)
  };
}

/**
 * Get environmental equivalents
 */
function getEnvironmentalEquivalents(co2SavedKg) {
  const eq = CARBON_CONFIG.equivalents;
  
  return {
    treesEquivalent: Math.round(co2SavedKg * eq.treesPerKgCO2 * 10) / 10,
    kmNotDriven: Math.round(co2SavedKg * eq.drivingPerKgCO2),
    phoneCharges: Math.round(co2SavedKg * eq.phoneCharges),
    lightBulbHours: Math.round(co2SavedKg * eq.lightBulbHours),
    plasticBottles: Math.round(co2SavedKg * eq.plasticBottles)
  };
}

/**
 * Calculate user's total carbon impact
 */
async function calculateUserCarbonImpact(userId) {
  // Get completed bookings as passenger
  const passengerBookings = await Booking.find({
    passenger: userId,
    status: "completed"
  }).populate("ride", "estimatedDistance vehicleType").lean();
  
  // Get completed rides as driver
  const driverRides = await Ride.find({
    driver: userId,
    status: "completed"
  }).lean();
  
  // Calculate passenger savings
  let totalCO2SavedKg = 0;
  let totalFuelSavedL = 0;
  let totalMoneySaved = 0;
  let totalDistanceKm = 0;
  
  for (const booking of passengerBookings) {
    const distanceKm = (booking.ride?.estimatedDistance || 0) / 1000;
    totalDistanceKm += distanceKm;
    
    const carbonSavings = calculateRideCarbonSavings(distanceKm, booking.seats || 1);
    totalCO2SavedKg += carbonSavings.savedPerPassengerKg;
    
    const fuelSavings = calculateFuelSavings(distanceKm, 1);
    totalFuelSavedL += fuelSavings.fuelSavedLiters / 3; // Shared savings
    totalMoneySaved += fuelSavings.moneySavedRupees / 3;
  }
  
  // Calculate driver contribution (enabling others to save)
  let passengersMoved = 0;
  let driverContributionCO2 = 0;
  
  for (const ride of driverRides) {
    const distanceKm = (ride.estimatedDistance || 0) / 1000;
    const passengers = (ride.totalSeats || 4) - (ride.availableSeats || 0);
    passengersMoved += passengers;
    
    if (passengers > 0) {
      const savings = calculateRideCarbonSavings(distanceKm, passengers);
      driverContributionCO2 += savings.totalSavedKg;
    }
  }
  
  // Get equivalents
  const equivalents = getEnvironmentalEquivalents(totalCO2SavedKg + driverContributionCO2);
  
  return {
    userId,
    asPassenger: {
      ridesCompleted: passengerBookings.length,
      totalDistanceKm: Math.round(totalDistanceKm),
      co2SavedKg: Math.round(totalCO2SavedKg * 10) / 10,
      fuelSavedLiters: Math.round(totalFuelSavedL * 10) / 10,
      moneySavedRupees: Math.round(totalMoneySaved)
    },
    asDriver: {
      ridesCompleted: driverRides.length,
      passengersMoved,
      co2EnabledSavingsKg: Math.round(driverContributionCO2 * 10) / 10
    },
    total: {
      co2SavedKg: Math.round((totalCO2SavedKg + driverContributionCO2) * 10) / 10,
      fuelSavedLiters: Math.round(totalFuelSavedL * 10) / 10,
      moneySavedRupees: Math.round(totalMoneySaved)
    },
    equivalents,
    impactLevel: getImpactLevel(totalCO2SavedKg + driverContributionCO2)
  };
}

/**
 * Get impact level badge
 */
function getImpactLevel(co2SavedKg) {
  if (co2SavedKg >= 500) return { level: "champion", label: "Climate Champion", icon: "🏆" };
  if (co2SavedKg >= 200) return { level: "hero", label: "Eco Hero", icon: "🌟" };
  if (co2SavedKg >= 100) return { level: "advocate", label: "Green Advocate", icon: "🌱" };
  if (co2SavedKg >= 50) return { level: "conscious", label: "Eco Conscious", icon: "♻️" };
  if (co2SavedKg >= 10) return { level: "starter", label: "Getting Started", icon: "🚀" };
  return { level: "new", label: "New Carpooler", icon: "👋" };
}

/**
 * Calculate platform-wide carbon impact
 */
async function calculatePlatformCarbonImpact() {
  // Get all completed bookings
  const bookings = await Booking.find({ status: "completed" })
    .populate("ride", "estimatedDistance vehicleType")
    .lean();
  
  let totalCO2SavedKg = 0;
  let totalDistanceKm = 0;
  let totalPassengers = 0;
  
  for (const booking of bookings) {
    const distanceKm = (booking.ride?.estimatedDistance || 0) / 1000;
    totalDistanceKm += distanceKm;
    totalPassengers += booking.seats || 1;
    
    const savings = calculateRideCarbonSavings(distanceKm, booking.seats || 1);
    totalCO2SavedKg += savings.savedPerPassengerKg;
  }
  
  // Calculate totals
  const fuelSaved = totalCO2SavedKg / 2.3; // ~2.3kg CO2 per liter petrol
  const moneySaved = fuelSaved * CARBON_CONFIG.fuelPrices.petrol;
  
  const equivalents = getEnvironmentalEquivalents(totalCO2SavedKg);
  
  return {
    totalRides: bookings.length,
    totalPassengers,
    totalDistanceKm: Math.round(totalDistanceKm),
    totalCO2SavedKg: Math.round(totalCO2SavedKg),
    totalCO2SavedTons: Math.round(totalCO2SavedKg / 1000 * 10) / 10,
    totalFuelSavedLiters: Math.round(fuelSaved),
    totalMoneySavedRupees: Math.round(moneySaved),
    equivalents,
    avgSavingsPerRide: {
      co2Kg: bookings.length > 0 ? Math.round(totalCO2SavedKg / bookings.length * 10) / 10 : 0,
      fuelLiters: bookings.length > 0 ? Math.round(fuelSaved / bookings.length * 10) / 10 : 0
    }
  };
}

/**
 * Get carbon leaderboard
 */
async function getCarbonLeaderboard(limit = 10) {
  // Get users with most completed bookings
  const topUsers = await Booking.aggregate([
    { $match: { status: "completed" } },
    { $group: { 
      _id: "$passenger",
      bookingCount: { $sum: 1 },
      totalSeats: { $sum: "$seats" }
    }},
    { $sort: { bookingCount: -1 } },
    { $limit: limit * 2 } // Get more to filter out incomplete profiles
  ]);
  
  const leaderboard = [];
  
  for (const entry of topUsers) {
    if (leaderboard.length >= limit) break;
    
    const user = await User.findById(entry._id).select("name photo").lean();
    if (!user) continue;
    
    const impact = await calculateUserCarbonImpact(entry._id);
    
    leaderboard.push({
      rank: leaderboard.length + 1,
      userId: entry._id,
      name: user.name || "Anonymous",
      photo: user.photo,
      co2SavedKg: impact.total.co2SavedKg,
      ridesCompleted: impact.asPassenger.ridesCompleted + impact.asDriver.ridesCompleted,
      impactLevel: impact.impactLevel
    });
  }
  
  return leaderboard;
}

/**
 * Get monthly carbon stats for user
 */
async function getUserMonthlyCarbonStats(userId, months = 6) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const bookings = await Booking.aggregate([
    {
      $match: {
        passenger: userId,
        status: "completed",
        createdAt: { $gte: startDate }
      }
    },
    {
      $lookup: {
        from: "rides",
        localField: "ride",
        foreignField: "_id",
        as: "rideData"
      }
    },
    {
      $unwind: "$rideData"
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        rides: { $sum: 1 },
        totalDistance: { $sum: "$rideData.estimatedDistance" },
        totalSeats: { $sum: "$seats" }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);
  
  return bookings.map(entry => {
    const distanceKm = (entry.totalDistance || 0) / 1000;
    const savings = calculateRideCarbonSavings(distanceKm, entry.totalSeats || 1);
    
    return {
      year: entry._id.year,
      month: entry._id.month,
      monthLabel: new Date(entry._id.year, entry._id.month - 1).toLocaleDateString('en-US', { 
        month: 'short', year: 'numeric' 
      }),
      rides: entry.rides,
      distanceKm: Math.round(distanceKm),
      co2SavedKg: savings.savedPerPassengerKg
    };
  });
}

/**
 * Calculate ride preview carbon impact (before booking)
 */
function previewCarbonImpact(distanceKm, passengers = 1) {
  const carbon = calculateRideCarbonSavings(distanceKm, passengers);
  const fuel = calculateFuelSavings(distanceKm, passengers);
  const equivalents = getEnvironmentalEquivalents(carbon.savedPerPassengerKg);
  
  return {
    distance: {
      km: Math.round(distanceKm * 10) / 10
    },
    perPassenger: {
      co2SavedKg: carbon.savedPerPassengerKg,
      co2SavedGrams: Math.round(carbon.savedPerPassengerKg * 1000),
      fuelSavedLiters: Math.round(fuel.fuelSavedLiters / passengers * 10) / 10,
      moneySavedRupees: Math.round(fuel.moneySavedRupees / passengers)
    },
    equivalents: {
      treePlanting: `${equivalents.treesEquivalent} trees for a year`,
      phoneCharges: `${equivalents.phoneCharges} phone charges`,
      plasticBottles: `${equivalents.plasticBottles} plastic bottles`
    },
    message: `Save ${carbon.savedPerPassengerKg}kg CO₂ by sharing this ride! 🌱`
  };
}

module.exports = {
  calculateRideCarbonSavings,
  calculateFuelSavings,
  calculateUserCarbonImpact,
  calculatePlatformCarbonImpact,
  getCarbonLeaderboard,
  getUserMonthlyCarbonStats,
  previewCarbonImpact,
  getEnvironmentalEquivalents,
  getImpactLevel,
  CARBON_CONFIG
};
