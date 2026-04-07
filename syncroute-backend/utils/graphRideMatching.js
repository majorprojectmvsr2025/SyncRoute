/**
 * Advanced Graph-Based Ride Matching System
 * 
 * Uses graph algorithms (Dijkstra, A*) to calculate route overlap
 * and optimize ride matching based on multiple factors.
 */

const geolib = require("geolib");

// Graph configuration
const EARTH_RADIUS_KM = 6371;
const GRAPH_RESOLUTION_METERS = 500; // Create nodes every 500m
const MAX_DETOUR_KM = 5; // Maximum acceptable detour
const NEAR_ROUTE_THRESHOLD_M = 2000; // 2km to be considered "on route"

/**
 * Priority Queue for Dijkstra/A* algorithms
 */
class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  push(node, priority) {
    this.heap.push({ node, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min.node;
  }

  bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[parentIdx].priority <= this.heap[idx].priority) break;
      [this.heap[parentIdx], this.heap[idx]] = [this.heap[idx], this.heap[parentIdx]];
      idx = parentIdx;
    }
  }

  bubbleDown(idx) {
    const length = this.heap.length;
    while (true) {
      const leftIdx = 2 * idx + 1;
      const rightIdx = 2 * idx + 2;
      let smallest = idx;

      if (leftIdx < length && this.heap[leftIdx].priority < this.heap[smallest].priority) {
        smallest = leftIdx;
      }
      if (rightIdx < length && this.heap[rightIdx].priority < this.heap[smallest].priority) {
        smallest = rightIdx;
      }
      if (smallest === idx) break;
      [this.heap[smallest], this.heap[idx]] = [this.heap[idx], this.heap[smallest]];
      idx = smallest;
    }
  }

  isEmpty() {
    return this.heap.length === 0;
  }
}

/**
 * Create a graph node ID from coordinates
 */
function createNodeId(lat, lng) {
  // Round to ~100m precision for node identification
  const latRounded = Math.round(lat * 10000) / 10000;
  const lngRounded = Math.round(lng * 10000) / 10000;
  return `${latRounded},${lngRounded}`;
}

/**
 * Calculate haversine distance between two points
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = EARTH_RADIUS_KM * 1000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build a graph from route coordinates
 * @param {Array} routeCoords - Array of [lng, lat] coordinates
 * @returns {Object} Graph with nodes and edges
 */
function buildRouteGraph(routeCoords) {
  const nodes = new Map();
  const edges = new Map();

  // Sample route at regular intervals to create nodes
  let accumulatedDistance = 0;
  let lastNodeId = null;

  for (let i = 0; i < routeCoords.length; i++) {
    const [lng, lat] = routeCoords[i];
    
    if (i > 0) {
      const [prevLng, prevLat] = routeCoords[i - 1];
      accumulatedDistance += haversineDistance(prevLat, prevLng, lat, lng);
    }

    // Create node at start, end, or every GRAPH_RESOLUTION_METERS
    const shouldCreateNode = 
      i === 0 || 
      i === routeCoords.length - 1 || 
      accumulatedDistance >= GRAPH_RESOLUTION_METERS;

    if (shouldCreateNode) {
      const nodeId = createNodeId(lat, lng);
      nodes.set(nodeId, { lat, lng, index: i });

      if (lastNodeId && lastNodeId !== nodeId) {
        // Add edge from last node to this node
        if (!edges.has(lastNodeId)) edges.set(lastNodeId, []);
        edges.get(lastNodeId).push({
          to: nodeId,
          distance: accumulatedDistance
        });
      }

      lastNodeId = nodeId;
      accumulatedDistance = 0;
    }
  }

  return { nodes, edges };
}

/**
 * A* search algorithm for finding shortest path
 * @param {Object} graph - Graph with nodes and edges
 * @param {string} startId - Start node ID
 * @param {string} endId - End node ID
 * @returns {Object} Path with nodes and total distance
 */
function aStarSearch(graph, startId, endId) {
  const { nodes, edges } = graph;
  
  if (!nodes.has(startId) || !nodes.has(endId)) {
    return { path: [], distance: Infinity };
  }

  const endNode = nodes.get(endId);
  const openSet = new PriorityQueue();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(startId, 0);
  const startNode = nodes.get(startId);
  const heuristic = haversineDistance(startNode.lat, startNode.lng, endNode.lat, endNode.lng);
  fScore.set(startId, heuristic);
  openSet.push(startId, heuristic);

  while (!openSet.isEmpty()) {
    const current = openSet.pop();

    if (current === endId) {
      // Reconstruct path
      const path = [current];
      let node = current;
      while (cameFrom.has(node)) {
        node = cameFrom.get(node);
        path.unshift(node);
      }
      return { path, distance: gScore.get(endId) };
    }

    const neighbors = edges.get(current) || [];
    for (const { to, distance } of neighbors) {
      const tentativeG = gScore.get(current) + distance;
      
      if (!gScore.has(to) || tentativeG < gScore.get(to)) {
        cameFrom.set(to, current);
        gScore.set(to, tentativeG);
        
        const toNode = nodes.get(to);
        const h = haversineDistance(toNode.lat, toNode.lng, endNode.lat, endNode.lng);
        fScore.set(to, tentativeG + h);
        
        openSet.push(to, tentativeG + h);
      }
    }
  }

  return { path: [], distance: Infinity };
}

/**
 * Find closest node on route to a given point
 * @param {Object} graph - Graph with nodes
 * @param {number} lat - Target latitude
 * @param {number} lng - Target longitude
 * @returns {Object} Closest node info
 */
function findClosestNode(graph, lat, lng) {
  let closest = null;
  let minDist = Infinity;

  for (const [nodeId, node] of graph.nodes) {
    const dist = haversineDistance(lat, lng, node.lat, node.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = { nodeId, node, distance: dist };
    }
  }

  return closest;
}

/**
 * Calculate route overlap between driver and passenger routes
 * @param {Array} driverRoute - Driver's route coordinates [lng, lat]
 * @param {Object} passenger - { pickupLat, pickupLng, dropLat, dropLng }
 * @returns {Object} Overlap analysis
 */
function calculateRouteOverlap(driverRoute, passenger) {
  if (!driverRoute || driverRoute.length < 2) {
    return { overlap: 0, score: 0, detourKm: Infinity, isViable: false };
  }

  const { pickupLat, pickupLng, dropLat, dropLng } = passenger;
  
  // Build graph from driver's route
  const graph = buildRouteGraph(driverRoute);
  
  // Find closest nodes to pickup and dropoff
  const pickupNode = findClosestNode(graph, pickupLat, pickupLng);
  const dropNode = findClosestNode(graph, dropLat, dropLng);
  
  if (!pickupNode || !dropNode) {
    return { overlap: 0, score: 0, detourKm: Infinity, isViable: false };
  }

  // Check if pickup/drop are within acceptable distance from route
  if (pickupNode.distance > NEAR_ROUTE_THRESHOLD_M || dropNode.distance > NEAR_ROUTE_THRESHOLD_M) {
    return { 
      overlap: 0, 
      score: 0, 
      detourKm: Math.max(pickupNode.distance, dropNode.distance) / 1000,
      isViable: false,
      reason: "Pickup or drop too far from route"
    };
  }

  // Ensure pickup comes before drop in route direction
  if (pickupNode.node.index >= dropNode.node.index) {
    return { 
      overlap: 0, 
      score: 0, 
      detourKm: 0,
      isViable: false,
      reason: "Pickup must be before drop on route"
    };
  }

  // Calculate overlap using A* between pickup and drop nodes
  const pathResult = aStarSearch(graph, pickupNode.nodeId, dropNode.nodeId);
  
  // Calculate total route distance
  let totalRouteDistance = 0;
  for (const edgeList of graph.edges.values()) {
    for (const edge of edgeList) {
      totalRouteDistance += edge.distance;
    }
  }

  // Calculate direct distance passenger needs to travel
  const passengerDirectDistance = haversineDistance(
    pickupLat, pickupLng, dropLat, dropLng
  );

  // Detour = distance to reach pickup + distance from drop to continue route
  const detourKm = (pickupNode.distance + dropNode.distance) / 1000;
  
  // Overlap percentage
  const overlapRatio = pathResult.distance / totalRouteDistance;
  
  // Score calculation (0-1)
  // Higher score = better match
  const detourPenalty = Math.min(1, detourKm / MAX_DETOUR_KM);
  const overlapBonus = Math.min(1, overlapRatio);
  const routeAlignmentScore = pathResult.distance > 0 ? 
    Math.min(1, passengerDirectDistance / pathResult.distance) : 0;

  const score = (
    0.4 * (1 - detourPenalty) +  // Lower detour = higher score
    0.35 * overlapBonus +         // Higher overlap = higher score
    0.25 * routeAlignmentScore    // Route alignment bonus
  );

  return {
    overlap: pathResult.distance,
    overlapPercentage: Math.round(overlapRatio * 100),
    detourKm: Math.round(detourKm * 100) / 100,
    score: Math.round(score * 1000) / 1000,
    isViable: detourKm <= MAX_DETOUR_KM,
    pathNodes: pathResult.path.length,
    pickupDistanceM: Math.round(pickupNode.distance),
    dropDistanceM: Math.round(dropNode.distance),
    passengerTripDistance: Math.round(pathResult.distance)
  };
}

/**
 * Multi-objective ride matching score
 * Combines route overlap with other factors
 */
function calculateMultiObjectiveScore(ride, passenger, userPreferences = {}) {
  const routeCoords = ride.routePath?.coordinates || [];
  
  // 1. Route overlap score
  const overlapAnalysis = calculateRouteOverlap(routeCoords, passenger);
  
  if (!overlapAnalysis.isViable) {
    return {
      totalScore: 0,
      breakdown: { routeOverlap: 0 },
      isViable: false,
      reason: overlapAnalysis.reason || "Route not viable"
    };
  }

  // 2. Time compatibility score (0-1)
  let timeScore = 1;
  if (passenger.preferredDepartureTime && ride.departureTime) {
    const rideHour = parseInt(ride.departureTime.split(":")[0]);
    const prefHour = parseInt(passenger.preferredDepartureTime.split(":")[0]);
    const hourDiff = Math.abs(rideHour - prefHour);
    timeScore = Math.max(0, 1 - hourDiff / 4); // Full score within 4 hours
  }

  // 3. Seat availability score
  const seatScore = ride.availableSeats >= (passenger.seats || 1) ? 1 : 0;

  // 4. Driver reliability score (0-1)
  const reliabilityScore = (ride.driver?.reliabilityScore?.score || 70) / 100;

  // 5. Price score (0-1) - lower price = higher score
  let priceScore = 1;
  if (passenger.maxPrice && ride.price) {
    priceScore = ride.price <= passenger.maxPrice ? 
      1 - (ride.price / passenger.maxPrice) * 0.5 : 0;
  }

  // 6. Preference matches
  let preferenceScore = 1;
  const prefMatches = [];
  
  if (userPreferences.vehicleType && ride.vehicleType) {
    if (ride.vehicleType === userPreferences.vehicleType) {
      prefMatches.push("vehicleType");
    } else {
      preferenceScore -= 0.1;
    }
  }
  
  if (userPreferences.musicPreference && ride.musicPreference) {
    if (ride.musicPreference === userPreferences.musicPreference || ride.musicPreference === "any") {
      prefMatches.push("music");
    } else {
      preferenceScore -= 0.1;
    }
  }
  
  if (userPreferences.smokingAllowed !== undefined && ride.smokingAllowed !== undefined) {
    if (ride.smokingAllowed === userPreferences.smokingAllowed) {
      prefMatches.push("smoking");
    } else {
      preferenceScore -= 0.15;
    }
  }

  // Weights for multi-objective optimization
  const weights = {
    routeOverlap: 0.30,
    timeCompatibility: 0.20,
    seatAvailability: 0.15,
    driverReliability: 0.15,
    price: 0.10,
    preferences: 0.10
  };

  const totalScore = 
    weights.routeOverlap * overlapAnalysis.score +
    weights.timeCompatibility * timeScore +
    weights.seatAvailability * seatScore +
    weights.driverReliability * reliabilityScore +
    weights.price * priceScore +
    weights.preferences * Math.max(0, preferenceScore);

  return {
    totalScore: Math.round(totalScore * 1000) / 1000,
    breakdown: {
      routeOverlap: Math.round(overlapAnalysis.score * 100),
      timeCompatibility: Math.round(timeScore * 100),
      seatAvailability: seatScore * 100,
      driverReliability: Math.round(reliabilityScore * 100),
      price: Math.round(priceScore * 100),
      preferences: Math.round(Math.max(0, preferenceScore) * 100)
    },
    isViable: seatScore > 0,
    overlapAnalysis,
    matchedPreferences: prefMatches,
    detourKm: overlapAnalysis.detourKm,
    estimatedTripDistance: overlapAnalysis.passengerTripDistance
  };
}

/**
 * Find K-best ride matches using multi-objective scoring
 * @param {Array} rides - Available rides
 * @param {Object} passenger - Passenger requirements
 * @param {Object} userPreferences - User's preferences
 * @param {number} k - Number of top matches to return
 * @returns {Array} Top K matched rides with scores
 */
function findKBestMatches(rides, passenger, userPreferences = {}, k = 10) {
  const scoredRides = [];

  for (const ride of rides) {
    const matchScore = calculateMultiObjectiveScore(ride, passenger, userPreferences);
    
    if (matchScore.isViable && matchScore.totalScore > 0) {
      scoredRides.push({
        ride,
        ...matchScore
      });
    }
  }

  // Sort by total score descending
  scoredRides.sort((a, b) => b.totalScore - a.totalScore);

  // Return top K
  return scoredRides.slice(0, k);
}

/**
 * Batch process rides for matching efficiency
 */
async function batchMatchRides(rides, passengers) {
  const results = new Map();

  for (const passenger of passengers) {
    const matches = findKBestMatches(rides, passenger, passenger.preferences || {});
    results.set(passenger.userId || passenger.id, matches);
  }

  return results;
}

module.exports = {
  // Graph utilities
  buildRouteGraph,
  aStarSearch,
  findClosestNode,
  createNodeId,
  
  // Matching functions
  calculateRouteOverlap,
  calculateMultiObjectiveScore,
  findKBestMatches,
  batchMatchRides,
  
  // Distance utility
  haversineDistance,
  
  // Constants
  NEAR_ROUTE_THRESHOLD_M,
  MAX_DETOUR_KM,
  GRAPH_RESOLUTION_METERS
};
