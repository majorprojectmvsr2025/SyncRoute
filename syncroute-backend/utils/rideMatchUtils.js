const { getDistance } = require("geolib");

/**
 * Finds the closest point on a GeoJSON route polyline to a query lat/lng.
 * routeCoords: array of [lng, lat] pairs (GeoJSON order)
 * Returns { idx, dist } where dist is in metres.
 */
function closestRoutePoint(routeCoords, qLat, qLng) {
  let minDist = Infinity, minIdx = 0;
  for (let i = 0; i < routeCoords.length; i++) {
    const [rlng, rlat] = routeCoords[i];
    const d = getDistance(
      { latitude: rlat, longitude: rlng },
      { latitude: qLat, longitude: qLng }
    );
    if (d < minDist) { minDist = d; minIdx = i; }
  }
  return { idx: minIdx, dist: minDist };
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
    dist += getDistance(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 }
    );
  }
  return dist;
}

/**
 * Calculates the proportional price for a partial trip.
 * Returns the full price when overlap/total data is unavailable.
 * Minimum price is 1.
 */
function proportionalPrice(basePrice, overlapDistM, totalDistM) {
  if (overlapDistM == null || !totalDistM || totalDistM <= 0) return basePrice;
  return Math.max(1, Math.round(basePrice * overlapDistM / totalDistM));
}

module.exports = { closestRoutePoint, segmentDistance, proportionalPrice };
