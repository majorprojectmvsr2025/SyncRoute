/**
 * Route Deviation Detection Utility
 * 
 * Compares actual GPS location with planned route
 * and detects significant sustained deviations.
 */

const { getDistance } = require("geolib");

// Configuration
const CONFIG = {
  // Distance threshold in meters for deviation alert
  DEVIATION_THRESHOLD_M: 1500, // 1.5 km
  
  // Number of consecutive deviations before alert
  CONSECUTIVE_DEVIATIONS_REQUIRED: 3,
  
  // Minimum time between alerts (seconds)
  ALERT_COOLDOWN_S: 300, // 5 minutes
  
  // Max distance to search along route for closest point
  MAX_ROUTE_SEARCH_POINTS: 500,
  
  // Minimum distance traveled before checking deviation
  MIN_TRAVEL_DISTANCE_M: 500
};

/**
 * Find the closest point on a route to a given position
 * @param {Array} routeCoords - Array of [lng, lat] coordinates
 * @param {Number} lat - Current latitude
 * @param {Number} lng - Current longitude
 * @returns {Object} - { index, distance, point }
 */
function findClosestRoutePoint(routeCoords, lat, lng) {
  if (!routeCoords || routeCoords.length === 0) {
    return { index: -1, distance: Infinity, point: null };
  }
  
  let minDist = Infinity;
  let closestIdx = 0;
  let closestPoint = null;
  
  // Sample points along route for efficiency
  const step = Math.max(1, Math.floor(routeCoords.length / CONFIG.MAX_ROUTE_SEARCH_POINTS));
  
  for (let i = 0; i < routeCoords.length; i += step) {
    const [rLng, rLat] = routeCoords[i];
    const dist = getDistance(
      { latitude: lat, longitude: lng },
      { latitude: rLat, longitude: rLng }
    );
    
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
      closestPoint = [rLng, rLat];
    }
  }
  
  // Fine-tune around closest point
  const searchStart = Math.max(0, closestIdx - step);
  const searchEnd = Math.min(routeCoords.length - 1, closestIdx + step);
  
  for (let i = searchStart; i <= searchEnd; i++) {
    const [rLng, rLat] = routeCoords[i];
    const dist = getDistance(
      { latitude: lat, longitude: lng },
      { latitude: rLat, longitude: rLng }
    );
    
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
      closestPoint = [rLng, rLat];
    }
  }
  
  return {
    index: closestIdx,
    distance: minDist,
    point: closestPoint
  };
}

/**
 * Check if current location represents a significant deviation
 * @param {Object} params - Check parameters
 * @returns {Object} - Deviation check result
 */
function checkDeviation(params) {
  const {
    currentLat,
    currentLng,
    routeCoords,
    previousDeviationCount = 0,
    lastDeviationAlert = null
  } = params;
  
  const result = {
    isDeviated: false,
    distance: 0,
    shouldAlert: false,
    newDeviationCount: previousDeviationCount,
    closestRoutePoint: null,
    message: null
  };
  
  if (!routeCoords || routeCoords.length < 2) {
    result.message = "No route data available";
    return result;
  }
  
  // Find closest point on route
  const closest = findClosestRoutePoint(routeCoords, currentLat, currentLng);
  result.distance = closest.distance;
  result.closestRoutePoint = closest.point;
  
  // Check if deviation threshold exceeded
  if (closest.distance > CONFIG.DEVIATION_THRESHOLD_M) {
    result.isDeviated = true;
    result.newDeviationCount = previousDeviationCount + 1;
    
    // Check if sustained deviation (consecutive checks)
    if (result.newDeviationCount >= CONFIG.CONSECUTIVE_DEVIATIONS_REQUIRED) {
      // Check cooldown
      const now = new Date();
      const cooldownExpired = !lastDeviationAlert || 
        (now - new Date(lastDeviationAlert)) / 1000 > CONFIG.ALERT_COOLDOWN_S;
      
      if (cooldownExpired) {
        result.shouldAlert = true;
        result.message = `Vehicle is ${Math.round(closest.distance / 1000 * 10) / 10}km away from planned route`;
      } else {
        result.message = "Deviation detected but within alert cooldown period";
      }
    } else {
      result.message = `Minor deviation detected (${result.newDeviationCount}/${CONFIG.CONSECUTIVE_DEVIATIONS_REQUIRED})`;
    }
  } else {
    // Back on track - reset counter
    result.newDeviationCount = 0;
    result.message = "On route";
  }
  
  return result;
}

/**
 * Calculate remaining route distance from current position
 * @param {Array} routeCoords - Route coordinates
 * @param {Number} currentLat - Current latitude
 * @param {Number} currentLng - Current longitude
 * @returns {Number} - Remaining distance in meters
 */
function calculateRemainingDistance(routeCoords, currentLat, currentLng) {
  if (!routeCoords || routeCoords.length < 2) return 0;
  
  const closest = findClosestRoutePoint(routeCoords, currentLat, currentLng);
  if (closest.index < 0) return 0;
  
  let distance = 0;
  
  // Sum distances from closest point to end
  for (let i = closest.index; i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];
    
    distance += getDistance(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 }
    );
  }
  
  return distance;
}

/**
 * Estimate remaining time based on current speed and remaining distance
 * @param {Number} remainingDistanceM - Remaining distance in meters
 * @param {Number} currentSpeedMps - Current speed in m/s (default ~30 km/h)
 * @returns {Number} - Estimated seconds remaining
 */
function estimateRemainingTime(remainingDistanceM, currentSpeedMps = 8.33) {
  if (!remainingDistanceM || remainingDistanceM <= 0) return 0;
  if (!currentSpeedMps || currentSpeedMps <= 0) currentSpeedMps = 8.33; // Default ~30 km/h
  
  return Math.round(remainingDistanceM / currentSpeedMps);
}

/**
 * Calculate route progress percentage
 * @param {Array} routeCoords - Route coordinates
 * @param {Number} currentLat - Current latitude
 * @param {Number} currentLng - Current longitude
 * @returns {Number} - Progress percentage (0-100)
 */
function calculateRouteProgress(routeCoords, currentLat, currentLng) {
  if (!routeCoords || routeCoords.length < 2) return 0;
  
  // Calculate total route distance
  let totalDistance = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];
    totalDistance += getDistance(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 }
    );
  }
  
  const remaining = calculateRemainingDistance(routeCoords, currentLat, currentLng);
  const traveled = totalDistance - remaining;
  
  if (totalDistance <= 0) return 0;
  
  const progress = Math.round((traveled / totalDistance) * 100);
  return Math.max(0, Math.min(100, progress));
}

/**
 * Check if vehicle has arrived at destination
 * @param {Array} routeCoords - Route coordinates
 * @param {Number} currentLat - Current latitude
 * @param {Number} currentLng - Current longitude
 * @param {Number} arrivalThresholdM - Distance to consider as arrived (default 200m)
 * @returns {Boolean}
 */
function hasArrivedAtDestination(routeCoords, currentLat, currentLng, arrivalThresholdM = 200) {
  if (!routeCoords || routeCoords.length < 2) return false;
  
  const destination = routeCoords[routeCoords.length - 1];
  const [destLng, destLat] = destination;
  
  const distToDestination = getDistance(
    { latitude: currentLat, longitude: currentLng },
    { latitude: destLat, longitude: destLng }
  );
  
  return distToDestination <= arrivalThresholdM;
}

module.exports = {
  findClosestRoutePoint,
  checkDeviation,
  calculateRemainingDistance,
  estimateRemainingTime,
  calculateRouteProgress,
  hasArrivedAtDestination,
  CONFIG
};
