const { getDistance } = require("geolib");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS - Realistic thresholds for ride matching
// ─────────────────────────────────────────────────────────────────────────────
const WALKABLE_DISTANCE_M = 500;          // Max 500m walk to/from route
const MIN_OVERLAP_PERCENTAGE = 60;        // Minimum 60% route overlap required
const MAX_DETOUR_DISTANCE_M = 2000;       // Max 2km detour acceptable
const FALLBACK_MATCH_DISTANCE_M = 5000;   // 5km for fallback endpoint matching

/**
 * Haversine distance calculation (meters)
 * More accurate than geolib for our use case
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * 
    Math.cos((lat2 * Math.PI) / 180) * 
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Finds the closest point on a GeoJSON route polyline to a query lat/lng.
 * Uses point-to-segment distance for accuracy (not just point-to-point).
 * routeCoords: array of [lng, lat] pairs (GeoJSON order)
 * Returns { idx, dist, projectedPoint } where dist is in metres.
 */
function closestRoutePoint(routeCoords, qLat, qLng) {
  let minDist = Infinity;
  let minIdx = 0;
  let projectedPoint = null;

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];
    
    // Calculate distance from point to line segment
    const segDist = pointToSegmentDistance(qLat, qLng, lat1, lng1, lat2, lng2);
    
    if (segDist.dist < minDist) {
      minDist = segDist.dist;
      minIdx = i;
      projectedPoint = segDist.projected;
    }
  }

  // Also check the last point
  if (routeCoords.length > 0) {
    const [lastLng, lastLat] = routeCoords[routeCoords.length - 1];
    const d = haversineDistance(qLat, qLng, lastLat, lastLng);
    if (d < minDist) {
      minDist = d;
      minIdx = routeCoords.length - 1;
      projectedPoint = { lat: lastLat, lng: lastLng };
    }
  }

  return { idx: minIdx, dist: minDist, projectedPoint };
}

/**
 * Calculate shortest distance from a point to a line segment
 * Returns distance in meters and the projected point on the segment
 */
function pointToSegmentDistance(pLat, pLng, lat1, lng1, lat2, lng2) {
  const segLen = haversineDistance(lat1, lng1, lat2, lng2);
  
  if (segLen === 0) {
    return {
      dist: haversineDistance(pLat, pLng, lat1, lng1),
      projected: { lat: lat1, lng: lng1 }
    };
  }

  // Project point onto segment line
  const t = Math.max(0, Math.min(1, (
    (pLat - lat1) * (lat2 - lat1) + (pLng - lng1) * (lng2 - lng1)
  ) / (segLen * segLen / (111000 * 111000)))); // Approximate conversion

  const projLat = lat1 + t * (lat2 - lat1);
  const projLng = lng1 + t * (lng2 - lng1);

  return {
    dist: haversineDistance(pLat, pLng, projLat, projLng),
    projected: { lat: projLat, lng: projLng }
  };
}

/**
 * Calculates the road distance (metres) along a route polyline
 * between two segment indices (inclusive start, exclusive end handled by loop).
 * routeCoords: array of [lng, lat] pairs
 */
function segmentDistance(routeCoords, fromIdx, toIdx) {
  let dist = 0;
  for (let i = fromIdx; i < toIdx && i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];
    dist += haversineDistance(lat1, lng1, lat2, lng2);
  }
  return dist;
}

/**
 * Calculate total route distance
 */
function totalRouteDistance(routeCoords) {
  return segmentDistance(routeCoords, 0, routeCoords.length - 1);
}

/**
 * Calculate passenger direct distance (straight line)
 */
function passengerDirectDistance(pickupLat, pickupLng, dropLat, dropLng) {
  return haversineDistance(pickupLat, pickupLng, dropLat, dropLng);
}

/**
 * Advanced route overlap calculation
 * Returns detailed overlap analysis including percentage
 * 
 * @param {Array} driverRouteCoords - Driver's route [lng, lat] pairs
 * @param {number} pickupLat - Passenger pickup latitude
 * @param {number} pickupLng - Passenger pickup longitude
 * @param {number} dropLat - Passenger drop latitude
 * @param {number} dropLng - Passenger drop longitude
 * @returns {Object} Detailed overlap analysis
 */
function calculateRouteOverlap(driverRouteCoords, pickupLat, pickupLng, dropLat, dropLng) {
  if (!driverRouteCoords || driverRouteCoords.length < 2) {
    return {
      isValid: false,
      reason: "Invalid driver route",
      overlapPercentage: 0,
      pickupDistM: Infinity,
      dropDistM: Infinity
    };
  }

  // Find closest points on driver route to pickup and drop
  const pickup = closestRoutePoint(driverRouteCoords, pickupLat, pickupLng);
  const drop = closestRoutePoint(driverRouteCoords, dropLat, dropLng);

  // Check walkable distance constraint (≤500m)
  if (pickup.dist > WALKABLE_DISTANCE_M) {
    return {
      isValid: false,
      reason: `Pickup too far from route (${Math.round(pickup.dist)}m > ${WALKABLE_DISTANCE_M}m)`,
      overlapPercentage: 0,
      pickupDistM: pickup.dist,
      dropDistM: drop.dist
    };
  }

  if (drop.dist > WALKABLE_DISTANCE_M) {
    return {
      isValid: false,
      reason: `Drop too far from route (${Math.round(drop.dist)}m > ${WALKABLE_DISTANCE_M}m)`,
      overlapPercentage: 0,
      pickupDistM: pickup.dist,
      dropDistM: drop.dist
    };
  }

  // Check direction: pickup must come before drop on the route
  if (pickup.idx > drop.idx) {
    return {
      isValid: false,
      reason: "Wrong direction - pickup after drop on route",
      overlapPercentage: 0,
      pickupDistM: pickup.dist,
      dropDistM: drop.dist
    };
  }

  // Calculate distances
  const passengerDirect = passengerDirectDistance(pickupLat, pickupLng, dropLat, dropLng);
  const overlapOnRoute = segmentDistance(driverRouteCoords, pickup.idx, drop.idx);
  const totalDriverRoute = totalRouteDistance(driverRouteCoords);

  // Handle edge case: very short trips (pickup and drop at same index)
  if (pickup.idx === drop.idx) {
    // For same-segment pickup/drop, calculate based on actual distances
    const effectiveOverlap = passengerDirect;
    const overlapPercentage = totalDriverRoute > 0 
      ? Math.min(100, Math.round((effectiveOverlap / passengerDirect) * 100))
      : 0;
    
    return {
      isValid: overlapPercentage >= MIN_OVERLAP_PERCENTAGE,
      reason: overlapPercentage >= MIN_OVERLAP_PERCENTAGE ? "Valid short trip" : "Trip too short",
      overlapPercentage,
      overlapDistM: effectiveOverlap,
      passengerDirectM: passengerDirect,
      totalRouteM: totalDriverRoute,
      pickupDistM: pickup.dist,
      dropDistM: drop.dist,
      pickupIdx: pickup.idx,
      dropIdx: drop.idx
    };
  }

  // Calculate overlap percentage based on how much of passenger's journey 
  // is covered by the driver's route
  // We use the ratio of route-overlap-distance to passenger-direct-distance
  // This ensures we're measuring actual route coverage, not just proximity
  const overlapRatio = passengerDirect > 0 ? overlapOnRoute / passengerDirect : 0;
  
  // Normalize: if route distance is similar to direct distance, overlap is good
  // If route distance is much longer (detour), penalty applies
  // If route distance is shorter (impossible for real roads), cap at 100%
  const efficiencyFactor = Math.min(1.5, Math.max(0.5, passengerDirect / (overlapOnRoute || 1)));
  const overlapPercentage = Math.round(Math.min(100, overlapRatio * efficiencyFactor * 100));

  // Check minimum overlap threshold
  if (overlapPercentage < MIN_OVERLAP_PERCENTAGE) {
    return {
      isValid: false,
      reason: `Insufficient route overlap (${overlapPercentage}% < ${MIN_OVERLAP_PERCENTAGE}%)`,
      overlapPercentage,
      overlapDistM: overlapOnRoute,
      passengerDirectM: passengerDirect,
      totalRouteM: totalDriverRoute,
      pickupDistM: pickup.dist,
      dropDistM: drop.dist,
      pickupIdx: pickup.idx,
      dropIdx: drop.idx
    };
  }

  // Calculate detour (extra distance driver travels vs direct path)
  const detourM = pickup.dist + drop.dist;
  
  return {
    isValid: true,
    reason: "Valid route match",
    overlapPercentage,
    overlapDistM: overlapOnRoute,
    passengerDirectM: passengerDirect,
    totalRouteM: totalDriverRoute,
    pickupDistM: pickup.dist,
    dropDistM: drop.dist,
    pickupIdx: pickup.idx,
    dropIdx: drop.idx,
    detourM,
    walkingToPickupMinutes: Math.round(pickup.dist / 80), // ~80m/min walking
    walkingFromDropMinutes: Math.round(drop.dist / 80)
  };
}

/**
 * Calculates the proportional price for a partial trip.
 * Returns the full price when overlap/total data is unavailable.
 * Minimum price is 10 to avoid unrealistic low prices.
 */
function proportionalPrice(basePrice, overlapDistM, totalDistM) {
  if (overlapDistM == null || !totalDistM || totalDistM <= 0) return basePrice;
  return Math.max(10, Math.round(basePrice * overlapDistM / totalDistM));
}

/**
 * Score a ride match (0-100) based on multiple factors
 */
function calculateMatchScore(overlapAnalysis) {
  if (!overlapAnalysis.isValid) return 0;

  // Weighted scoring
  const overlapScore = overlapAnalysis.overlapPercentage * 0.5;  // 50% weight
  const proximityScore = Math.max(0, (WALKABLE_DISTANCE_M - Math.max(overlapAnalysis.pickupDistM, overlapAnalysis.dropDistM)) / WALKABLE_DISTANCE_M) * 30;  // 30% weight
  const efficiencyScore = Math.min(1, overlapAnalysis.passengerDirectM / (overlapAnalysis.overlapDistM || 1)) * 20;  // 20% weight

  return Math.round(overlapScore + proximityScore + efficiencyScore);
}

module.exports = { 
  closestRoutePoint, 
  segmentDistance, 
  proportionalPrice,
  calculateRouteOverlap,
  haversineDistance,
  totalRouteDistance,
  passengerDirectDistance,
  calculateMatchScore,
  // Export constants for use in routes
  WALKABLE_DISTANCE_M,
  MIN_OVERLAP_PERCENTAGE,
  MAX_DETOUR_DISTANCE_M,
  FALLBACK_MATCH_DISTANCE_M
};
