/**
 * Dynamic Pricing System
 * 
 * Calculates ride prices based on:
 * - Distance
 * - Time of day (peak hours)
 * - Demand/supply ratio
 * - Fuel costs
 * - Weather conditions (optional)
 */

const Ride = require("../models/Ride");
const Booking = require("../models/Booking");

// Pricing configuration
const PRICING_CONFIG = {
  // Base pricing
  basePricePerKm: 8, // ₹8 per km
  minPrice: 50, // Minimum ride price
  maxSurgeMultiplier: 2.5, // Maximum surge pricing
  
  // Fuel costs (per km)
  fuelCostPerKm: {
    petrol: 5.5,
    diesel: 4.5,
    electric: 2.0,
    cng: 3.0
  },
  
  // Time-based multipliers
  peakHours: {
    morning: { start: 7, end: 10, multiplier: 1.3 },
    evening: { start: 17, end: 20, multiplier: 1.4 },
    lateNight: { start: 22, end: 5, multiplier: 1.2 }
  },
  
  // Day-based multipliers
  dayMultipliers: {
    weekday: 1.0,
    weekend: 1.1,
    holiday: 1.3
  },
  
  // Vehicle type multipliers
  vehicleMultipliers: {
    Sedan: 1.0,
    SUV: 1.3,
    Compact: 0.9,
    Van: 1.2
  },
  
  // Demand thresholds
  demandLevels: {
    low: { threshold: 0.3, multiplier: 0.9 },
    normal: { threshold: 0.6, multiplier: 1.0 },
    high: { threshold: 0.8, multiplier: 1.2 },
    surge: { threshold: 1.0, multiplier: 1.5 }
  }
};

// Cache for demand calculations (5 min TTL)
const demandCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get current hour (0-23)
 */
function getCurrentHour(timestamp = new Date()) {
  return timestamp.getHours();
}

/**
 * Check if time is within peak hours
 */
function getPeakMultiplier(hour) {
  const { peakHours } = PRICING_CONFIG;
  
  // Morning peak
  if (hour >= peakHours.morning.start && hour < peakHours.morning.end) {
    return peakHours.morning.multiplier;
  }
  
  // Evening peak
  if (hour >= peakHours.evening.start && hour < peakHours.evening.end) {
    return peakHours.evening.multiplier;
  }
  
  // Late night
  if (hour >= peakHours.lateNight.start || hour < peakHours.lateNight.end) {
    return peakHours.lateNight.multiplier;
  }
  
  return 1.0;
}

/**
 * Get day-based multiplier
 */
function getDayMultiplier(date = new Date()) {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  
  // Check for holidays (simplified - in production, use a holiday API)
  const holidays = [
    "01-26", // Republic Day
    "08-15", // Independence Day
    "10-02", // Gandhi Jayanti
    "12-25", // Christmas
  ];
  
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  if (holidays.includes(dateStr)) {
    return PRICING_CONFIG.dayMultipliers.holiday;
  }
  
  return isWeekend ? 
    PRICING_CONFIG.dayMultipliers.weekend : 
    PRICING_CONFIG.dayMultipliers.weekday;
}

/**
 * Calculate demand/supply ratio for an area
 * @param {Object} location - { lat, lng }
 * @param {Date} date - Target date
 * @param {number} radiusKm - Search radius
 */
async function calculateDemandSupplyRatio(location, date, radiusKm = 15) {
  const cacheKey = `${Math.round(location.lat * 100)}_${Math.round(location.lng * 100)}_${date.toDateString()}`;
  
  // Check cache
  const cached = demandCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.ratio;
  }
  
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dateStr = date.toISOString().split('T')[0];
    
    // Count available rides (supply)
    const ridesQuery = {
      status: "active",
      date: dateStr,
      availableSeats: { $gte: 1 },
      "from.location": {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [location.lng, location.lat]
          },
          $maxDistance: radiusKm * 1000
        }
      }
    };
    
    const supply = await Ride.countDocuments(ridesQuery);
    
    // Count recent searches/bookings (demand proxy)
    // In production, use a proper demand tracking system
    const demandQuery = {
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    };
    
    const recentBookings = await Booking.countDocuments(demandQuery);
    
    // Calculate ratio
    // Higher ratio = more demand relative to supply
    const demand = Math.max(1, recentBookings);
    const supplyAdjusted = Math.max(1, supply);
    const ratio = demand / (supplyAdjusted * 10); // Normalize
    
    // Cache result
    demandCache.set(cacheKey, { ratio, timestamp: Date.now() });
    
    return Math.min(2, ratio); // Cap at 2x
  } catch (error) {
    console.error("Demand calculation error:", error);
    return 1.0; // Default ratio
  }
}

/**
 * Get demand multiplier based on ratio
 */
function getDemandMultiplier(ratio) {
  const { demandLevels } = PRICING_CONFIG;
  
  if (ratio >= demandLevels.surge.threshold) {
    return demandLevels.surge.multiplier;
  }
  if (ratio >= demandLevels.high.threshold) {
    return demandLevels.high.multiplier;
  }
  if (ratio >= demandLevels.normal.threshold) {
    return demandLevels.normal.multiplier;
  }
  return demandLevels.low.multiplier;
}

/**
 * Calculate distance-based price component
 */
function calculateDistancePrice(distanceKm, vehicleType = "Sedan", fuelType = "petrol") {
  const basePricePerKm = PRICING_CONFIG.basePricePerKm;
  const fuelCost = PRICING_CONFIG.fuelCostPerKm[fuelType] || PRICING_CONFIG.fuelCostPerKm.petrol;
  const vehicleMultiplier = PRICING_CONFIG.vehicleMultipliers[vehicleType] || 1.0;
  
  return (basePricePerKm + fuelCost) * distanceKm * vehicleMultiplier;
}

/**
 * Calculate dynamic price for a ride
 * @param {Object} params - Pricing parameters
 * @returns {Object} Price breakdown
 */
async function calculateDynamicPrice(params) {
  const {
    distanceKm,
    vehicleType = "Sedan",
    fuelType = "petrol",
    departureTime,
    date = new Date(),
    fromLocation,
    seats = 1,
    includeDetailedBreakdown = false
  } = params;

  // Base distance price
  const basePrice = calculateDistancePrice(distanceKm, vehicleType, fuelType);
  
  // Time-based factors
  const departureHour = departureTime ? 
    parseInt(departureTime.split(":")[0]) : 
    getCurrentHour(date);
  
  const peakMultiplier = getPeakMultiplier(departureHour);
  const dayMultiplier = getDayMultiplier(date);
  
  // Demand factor
  let demandMultiplier = 1.0;
  if (fromLocation?.lat && fromLocation?.lng) {
    const demandRatio = await calculateDemandSupplyRatio(fromLocation, date);
    demandMultiplier = getDemandMultiplier(demandRatio);
  }
  
  // Calculate final price
  const combinedMultiplier = Math.min(
    PRICING_CONFIG.maxSurgeMultiplier,
    peakMultiplier * dayMultiplier * demandMultiplier
  );
  
  const totalPrice = Math.max(
    PRICING_CONFIG.minPrice,
    Math.round(basePrice * combinedMultiplier)
  );
  
  // Price per seat
  const pricePerSeat = Math.round(totalPrice / Math.max(1, seats));
  
  const result = {
    totalPrice,
    pricePerSeat,
    suggestedPriceRange: {
      min: Math.round(totalPrice * 0.85),
      max: Math.round(totalPrice * 1.15)
    },
    multiplier: Math.round(combinedMultiplier * 100) / 100,
    isPeakHour: peakMultiplier > 1,
    isSurge: demandMultiplier > 1.2
  };
  
  if (includeDetailedBreakdown) {
    result.breakdown = {
      basePrice: Math.round(basePrice),
      distanceKm: Math.round(distanceKm * 10) / 10,
      vehicleType,
      fuelType,
      peakMultiplier,
      dayMultiplier,
      demandMultiplier: Math.round(demandMultiplier * 100) / 100,
      combinedMultiplier
    };
  }
  
  return result;
}

/**
 * Get suggested price range for ride creation
 */
async function getSuggestedPriceRange(params) {
  const pricing = await calculateDynamicPrice({
    ...params,
    includeDetailedBreakdown: true
  });
  
  return {
    suggested: pricing.pricePerSeat,
    range: pricing.suggestedPriceRange,
    factors: {
      isPeakHour: pricing.isPeakHour,
      isSurge: pricing.isSurge,
      multiplier: pricing.multiplier
    },
    breakdown: pricing.breakdown
  };
}

/**
 * Validate driver's price against dynamic pricing
 */
async function validatePrice(driverPrice, params) {
  const suggested = await getSuggestedPriceRange(params);
  
  const minAllowed = Math.round(suggested.range.min * 0.7); // 30% below min
  const maxAllowed = Math.round(suggested.range.max * 1.5); // 50% above max
  
  return {
    isValid: driverPrice >= minAllowed && driverPrice <= maxAllowed,
    driverPrice,
    suggestedPrice: suggested.suggested,
    allowedRange: { min: minAllowed, max: maxAllowed },
    deviation: Math.round(((driverPrice - suggested.suggested) / suggested.suggested) * 100)
  };
}

/**
 * Get demand forecast for time slots
 */
async function getDemandForecast(location, date) {
  const slots = [
    { label: "Early Morning", start: 5, end: 7 },
    { label: "Morning Rush", start: 7, end: 10 },
    { label: "Late Morning", start: 10, end: 12 },
    { label: "Afternoon", start: 12, end: 15 },
    { label: "Late Afternoon", start: 15, end: 17 },
    { label: "Evening Rush", start: 17, end: 20 },
    { label: "Evening", start: 20, end: 22 },
    { label: "Night", start: 22, end: 24 }
  ];
  
  const forecasts = slots.map(slot => {
    const peakMult = getPeakMultiplier((slot.start + slot.end) / 2);
    const dayMult = getDayMultiplier(date);
    
    // Estimate demand level
    let demandLevel = "normal";
    const combinedMult = peakMult * dayMult;
    
    if (combinedMult >= 1.4) demandLevel = "high";
    else if (combinedMult >= 1.2) demandLevel = "moderate";
    else if (combinedMult <= 0.95) demandLevel = "low";
    
    return {
      ...slot,
      demandLevel,
      multiplier: Math.round(combinedMult * 100) / 100,
      suggestedPremium: combinedMult > 1 ? `+${Math.round((combinedMult - 1) * 100)}%` : null
    };
  });
  
  return {
    date: date.toISOString().split('T')[0],
    location,
    slots: forecasts
  };
}

/**
 * Clear demand cache (for testing or manual refresh)
 */
function clearDemandCache() {
  demandCache.clear();
}

module.exports = {
  calculateDynamicPrice,
  getSuggestedPriceRange,
  validatePrice,
  getDemandForecast,
  calculateDistancePrice,
  getPeakMultiplier,
  getDayMultiplier,
  clearDemandCache,
  PRICING_CONFIG
};
