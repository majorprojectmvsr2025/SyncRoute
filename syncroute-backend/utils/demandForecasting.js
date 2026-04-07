/**
 * Demand Forecasting System
 * 
 * Time-series based prediction for ride demand
 * using historical booking patterns.
 */

const Booking = require("../models/Booking");
const Ride = require("../models/Ride");

// Forecasting configuration
const FORECAST_CONFIG = {
  // Historical data window
  historyDays: 90,
  minDataPoints: 10,
  
  // Time slots
  slots: [
    { id: "early_morning", label: "Early Morning", start: 5, end: 7 },
    { id: "morning_rush", label: "Morning Rush", start: 7, end: 10 },
    { id: "late_morning", label: "Late Morning", start: 10, end: 12 },
    { id: "afternoon", label: "Afternoon", start: 12, end: 15 },
    { id: "late_afternoon", label: "Late Afternoon", start: 15, end: 17 },
    { id: "evening_rush", label: "Evening Rush", start: 17, end: 20 },
    { id: "evening", label: "Evening", start: 20, end: 22 },
    { id: "night", label: "Night", start: 22, end: 24 }
  ],
  
  // Location clustering (grid size in degrees)
  gridSize: 0.05, // ~5km grid cells
  
  // Smoothing factor for exponential moving average
  emaAlpha: 0.3
};

/**
 * Get grid cell ID for a location
 */
function getGridCell(lat, lng) {
  const gridLat = Math.floor(lat / FORECAST_CONFIG.gridSize) * FORECAST_CONFIG.gridSize;
  const gridLng = Math.floor(lng / FORECAST_CONFIG.gridSize) * FORECAST_CONFIG.gridSize;
  return `${gridLat.toFixed(3)}_${gridLng.toFixed(3)}`;
}

/**
 * Get time slot for an hour
 */
function getTimeSlot(hour) {
  for (const slot of FORECAST_CONFIG.slots) {
    if (hour >= slot.start && hour < slot.end) {
      return slot;
    }
  }
  return FORECAST_CONFIG.slots[0]; // Default to early morning
}

/**
 * Calculate exponential moving average
 */
function exponentialMovingAverage(data, alpha = FORECAST_CONFIG.emaAlpha) {
  if (data.length === 0) return 0;
  
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = alpha * data[i] + (1 - alpha) * ema;
  }
  return ema;
}

/**
 * Get historical booking patterns
 */
async function getHistoricalPatterns(location, radiusKm = 10) {
  const historyStart = new Date();
  historyStart.setDate(historyStart.getDate() - FORECAST_CONFIG.historyDays);
  
  // Query bookings in the area
  const bookings = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: historyStart },
        status: { $in: ["confirmed", "completed"] }
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
      $match: location ? {
        "rideData.from.location": {
          $geoWithin: {
            $centerSphere: [
              [location.lng, location.lat],
              radiusKm / 6378.1 // Convert km to radians
            ]
          }
        }
      } : {}
    },
    {
      $project: {
        createdAt: 1,
        hour: { $hour: "$createdAt" },
        dayOfWeek: { $dayOfWeek: "$createdAt" },
        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
      }
    }
  ]);
  
  return bookings;
}

/**
 * Aggregate patterns by time slot and day
 */
function aggregatePatterns(bookings) {
  const patterns = {};
  
  // Initialize pattern structure
  for (const slot of FORECAST_CONFIG.slots) {
    patterns[slot.id] = {
      total: 0,
      byDay: [0, 0, 0, 0, 0, 0, 0], // Sun-Sat
      daily: {} // Date -> count
    };
  }
  
  // Aggregate bookings
  for (const booking of bookings) {
    const slot = getTimeSlot(booking.hour);
    const dayIdx = booking.dayOfWeek - 1; // MongoDB dayOfWeek is 1-7
    
    patterns[slot.id].total++;
    patterns[slot.id].byDay[dayIdx]++;
    
    if (!patterns[slot.id].daily[booking.date]) {
      patterns[slot.id].daily[booking.date] = 0;
    }
    patterns[slot.id].daily[booking.date]++;
  }
  
  return patterns;
}

/**
 * Calculate demand forecast for a location
 */
async function forecastDemand(location, targetDate) {
  const bookings = await getHistoricalPatterns(location);
  
  if (bookings.length < FORECAST_CONFIG.minDataPoints) {
    return {
      hasEnoughData: false,
      message: "Insufficient historical data for accurate forecast",
      slots: FORECAST_CONFIG.slots.map(slot => ({
        ...slot,
        forecast: "unknown",
        confidence: "low"
      }))
    };
  }
  
  const patterns = aggregatePatterns(bookings);
  const targetDay = targetDate.getDay(); // 0-6
  const totalDays = FORECAST_CONFIG.historyDays;
  
  // Calculate forecasts for each slot
  const forecasts = FORECAST_CONFIG.slots.map(slot => {
    const pattern = patterns[slot.id];
    
    // Calculate average demand for this slot on this day
    const sameWeekdayCount = Math.ceil(totalDays / 7);
    const avgForDay = pattern.byDay[targetDay] / sameWeekdayCount;
    
    // Calculate overall average
    const overallAvg = pattern.total / totalDays;
    
    // Apply exponential smoothing to recent data
    const recentDates = Object.keys(pattern.daily).sort().slice(-14);
    const recentCounts = recentDates.map(d => pattern.daily[d]);
    const trend = recentCounts.length > 0 ? exponentialMovingAverage(recentCounts) : overallAvg;
    
    // Combine day-specific and trend-based forecast
    const forecast = 0.6 * avgForDay + 0.4 * trend;
    
    // Determine demand level
    let demandLevel = "normal";
    if (forecast > overallAvg * 1.5) {
      demandLevel = "high";
    } else if (forecast > overallAvg * 1.2) {
      demandLevel = "moderate-high";
    } else if (forecast < overallAvg * 0.5) {
      demandLevel = "low";
    } else if (forecast < overallAvg * 0.8) {
      demandLevel = "moderate-low";
    }
    
    // Calculate confidence
    const dataPoints = pattern.byDay[targetDay];
    let confidence = "low";
    if (dataPoints >= 20) confidence = "high";
    else if (dataPoints >= 10) confidence = "medium";
    
    return {
      ...slot,
      forecast: Math.round(forecast * 10) / 10,
      demandLevel,
      confidence,
      metrics: {
        historicalAvg: Math.round(overallAvg * 10) / 10,
        dayAvg: Math.round(avgForDay * 10) / 10,
        recentTrend: Math.round(trend * 10) / 10,
        dataPoints
      }
    };
  });
  
  return {
    hasEnoughData: true,
    location: location ? `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}` : "all",
    targetDate: targetDate.toISOString().split('T')[0],
    targetDay: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][targetDay],
    slots: forecasts,
    summary: {
      peakSlots: forecasts.filter(f => f.demandLevel.includes("high")).map(f => f.label),
      lowSlots: forecasts.filter(f => f.demandLevel === "low").map(f => f.label)
    }
  };
}

/**
 * Get weekly demand pattern
 */
async function getWeeklyPattern(location) {
  const bookings = await getHistoricalPatterns(location);
  const patterns = aggregatePatterns(bookings);
  
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  // Calculate total demand per day
  const dailyDemand = days.map((day, idx) => {
    let total = 0;
    for (const slot of FORECAST_CONFIG.slots) {
      total += patterns[slot.id].byDay[idx];
    }
    return {
      day,
      dayIndex: idx,
      totalBookings: total,
      avgPerWeek: Math.round(total / (FORECAST_CONFIG.historyDays / 7) * 10) / 10
    };
  });
  
  // Find peak day
  const peakDay = dailyDemand.reduce((max, d) => 
    d.totalBookings > max.totalBookings ? d : max, dailyDemand[0]
  );
  
  return {
    pattern: dailyDemand,
    peakDay: peakDay.day,
    weekendVsWeekday: {
      weekendAvg: Math.round((dailyDemand[0].avgPerWeek + dailyDemand[6].avgPerWeek) / 2 * 10) / 10,
      weekdayAvg: Math.round(dailyDemand.slice(1, 6).reduce((s, d) => s + d.avgPerWeek, 0) / 5 * 10) / 10
    }
  };
}

/**
 * Get hourly demand pattern
 */
async function getHourlyPattern(location, targetDayOfWeek = null) {
  const bookings = await getHistoricalPatterns(location);
  
  // Filter by day of week if specified
  const filteredBookings = targetDayOfWeek !== null ?
    bookings.filter(b => b.dayOfWeek === targetDayOfWeek + 1) :
    bookings;
  
  // Group by hour
  const hourlyCount = Array(24).fill(0);
  for (const booking of filteredBookings) {
    hourlyCount[booking.hour]++;
  }
  
  // Normalize to average per day
  const days = targetDayOfWeek !== null ? 
    FORECAST_CONFIG.historyDays / 7 :
    FORECAST_CONFIG.historyDays;
  
  const hourlyPattern = hourlyCount.map((count, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
    avgBookings: Math.round(count / days * 100) / 100,
    relativeIntensity: hourlyCount.length > 0 ? 
      count / Math.max(...hourlyCount) : 0
  }));
  
  // Find peak hours
  const sortedHours = [...hourlyPattern].sort((a, b) => b.avgBookings - a.avgBookings);
  
  return {
    pattern: hourlyPattern,
    peakHours: sortedHours.slice(0, 3).map(h => h.label),
    quietHours: sortedHours.slice(-3).map(h => h.label)
  };
}

/**
 * Predict optimal ride posting times
 */
async function predictOptimalRideTimes(fromLocation, toLocation, targetDate) {
  // Get demand at origin
  const originForecast = await forecastDemand(fromLocation, targetDate);
  
  if (!originForecast.hasEnoughData) {
    return {
      success: false,
      message: "Insufficient data for predictions"
    };
  }
  
  // Rank slots by demand
  const rankedSlots = originForecast.slots
    .filter(s => s.demandLevel !== "low")
    .sort((a, b) => b.forecast - a.forecast);
  
  return {
    success: true,
    targetDate: targetDate.toISOString().split('T')[0],
    recommendations: rankedSlots.slice(0, 3).map((slot, idx) => ({
      rank: idx + 1,
      timeSlot: slot.label,
      startTime: `${slot.start.toString().padStart(2, '0')}:00`,
      endTime: `${slot.end.toString().padStart(2, '0')}:00`,
      demandLevel: slot.demandLevel,
      expectedRiders: slot.forecast,
      confidence: slot.confidence,
      recommendation: idx === 0 ? 
        "Best time to post your ride" :
        "Good alternative time"
    })),
    avoid: originForecast.slots
      .filter(s => s.demandLevel === "low")
      .map(s => s.label)
  };
}

/**
 * Get demand heatmap data for a region
 */
async function getDemandHeatmap(bounds, targetDate) {
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const gridSize = FORECAST_CONFIG.gridSize;
  
  const cells = [];
  
  for (let lat = minLat; lat < maxLat; lat += gridSize) {
    for (let lng = minLng; lng < maxLng; lng += gridSize) {
      const location = { lat: lat + gridSize / 2, lng: lng + gridSize / 2 };
      
      // Get simplified forecast
      const bookings = await getHistoricalPatterns(location, 5);
      const intensity = bookings.length / FORECAST_CONFIG.historyDays;
      
      cells.push({
        lat: location.lat,
        lng: location.lng,
        intensity: Math.min(1, intensity),
        bookingCount: bookings.length
      });
    }
  }
  
  return {
    targetDate: targetDate.toISOString().split('T')[0],
    gridSize,
    cells: cells.filter(c => c.bookingCount > 0)
  };
}

module.exports = {
  forecastDemand,
  getWeeklyPattern,
  getHourlyPattern,
  predictOptimalRideTimes,
  getDemandHeatmap,
  getGridCell,
  getTimeSlot,
  FORECAST_CONFIG
};
