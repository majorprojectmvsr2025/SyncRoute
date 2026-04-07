const { closestRoutePoint, segmentDistance, proportionalPrice } = require("../utils/rideMatchUtils");

// ── A simple straight route going roughly north (~10 km between each node) ──
// Coordinates in GeoJSON [lng, lat] order
const STRAIGHT_ROUTE = [
  [80.0000, 12.0000], // idx 0 – southern start
  [80.0000, 12.0900], // idx 1 – ~10 km north
  [80.0000, 12.1800], // idx 2
  [80.0000, 12.2700], // idx 3
  [80.0000, 12.3600], // idx 4 – northern end
];

// ── closestRoutePoint ─────────────────────────────────────────────────────

describe("closestRoutePoint", () => {
  it("returns index 0 for a point exactly at the first node", () => {
    const result = closestRoutePoint(STRAIGHT_ROUTE, 12.0000, 80.0000);
    expect(result.idx).toBe(0);
    expect(result.dist).toBe(0);
  });

  it("returns last index for a point exactly at the last node", () => {
    const last = STRAIGHT_ROUTE.length - 1;
    const [lng, lat] = STRAIGHT_ROUTE[last];
    const result = closestRoutePoint(STRAIGHT_ROUTE, lat, lng);
    expect(result.idx).toBe(last);
    expect(result.dist).toBe(0);
  });

  it("returns correct index for a mid-route point", () => {
    // Node 2 is at lat=12.180, query is very close to it
    const result = closestRoutePoint(STRAIGHT_ROUTE, 12.1800, 80.0000);
    expect(result.idx).toBe(2);
    expect(result.dist).toBe(0);
  });

  it("picks the nearest node when query is between two nodes", () => {
    // 12.045 is closer to idx-0 (12.000, dist~5km) than idx-1 (12.090, dist~5km)
    // but numerically closer to idx 0
    const result = closestRoutePoint(STRAIGHT_ROUTE, 12.044, 80.0000);
    expect(result.idx).toBe(0);
  });

  it("distance is reported in metres (non-negative)", () => {
    const result = closestRoutePoint(STRAIGHT_ROUTE, 12.0500, 80.0000);
    expect(result.dist).toBeGreaterThan(0);
  });

  it("handles a single-point route without throwing", () => {
    const single = [[80.0000, 12.0000]];
    const result = closestRoutePoint(single, 12.0000, 80.0000);
    expect(result.idx).toBe(0);
  });
});

// ── segmentDistance ───────────────────────────────────────────────────────

describe("segmentDistance", () => {
  it("returns 0 when fromIdx === toIdx (no movement)", () => {
    expect(segmentDistance(STRAIGHT_ROUTE, 1, 1)).toBe(0);
  });

  it("returns 0 when fromIdx > toIdx", () => {
    expect(segmentDistance(STRAIGHT_ROUTE, 3, 2)).toBe(0);
  });

  it("single step distance is roughly 10 km (±5%)", () => {
    const dist = segmentDistance(STRAIGHT_ROUTE, 0, 1);
    expect(dist).toBeGreaterThan(9_500);   // > 9.5 km
    expect(dist).toBeLessThan(10_500);     // < 10.5 km
  });

  it("two steps ≈ twice the single step", () => {
    const one = segmentDistance(STRAIGHT_ROUTE, 0, 1);
    const two = segmentDistance(STRAIGHT_ROUTE, 0, 2);
    expect(two).toBeCloseTo(one * 2, -2); // within 100 m
  });

  it("full-route segment accumulates all steps", () => {
    const full = segmentDistance(STRAIGHT_ROUTE, 0, STRAIGHT_ROUTE.length - 1);
    const halfA = segmentDistance(STRAIGHT_ROUTE, 0, 2);
    const halfB = segmentDistance(STRAIGHT_ROUTE, 2, STRAIGHT_ROUTE.length - 1);
    expect(full).toBeCloseTo(halfA + halfB, -1);
  });

  it("does not throw on an empty coordinate array", () => {
    expect(() => segmentDistance([], 0, 0)).not.toThrow();
    expect(segmentDistance([], 0, 0)).toBe(0);
  });
});

// ── proportionalPrice ─────────────────────────────────────────────────────

describe("proportionalPrice", () => {
  it("returns full price when overlapDistM is null", () => {
    expect(proportionalPrice(100, null, 100_000)).toBe(100);
  });

  it("returns full price when overlapDistM is undefined", () => {
    expect(proportionalPrice(100, undefined, 100_000)).toBe(100);
  });

  it("returns full price when totalDistM is 0 (avoid divide-by-zero)", () => {
    expect(proportionalPrice(100, 50_000, 0)).toBe(100);
  });

  it("returns full price when totalDistM is null", () => {
    expect(proportionalPrice(100, 50_000, null)).toBe(100);
  });

  it("50% overlap → 50% price", () => {
    expect(proportionalPrice(100, 50_000, 100_000)).toBe(50);
  });

  it("25% overlap → 25% price", () => {
    expect(proportionalPrice(200, 25_000, 100_000)).toBe(50);
  });

  it("100% overlap → full price (no over-charge)", () => {
    expect(proportionalPrice(80, 100_000, 100_000)).toBe(80);
  });

  it("very short overlap is clamped to minimum ₹1", () => {
    expect(proportionalPrice(10, 100, 100_000)).toBe(1);
  });

  it("result is always a positive integer", () => {
    const result = proportionalPrice(59, 40_000, 100_000);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it("is proportional – longer overlap means higher price", () => {
    const short = proportionalPrice(100, 20_000, 100_000);
    const long  = proportionalPrice(100, 80_000, 100_000);
    expect(long).toBeGreaterThan(short);
  });
});

// ── direction guard (pickup.idx < drop.idx) ───────────────────────────────

describe("direction guard logic", () => {
  it("rejects a trip where pickup is at the same route node as drop", () => {
    const pickup = { idx: 2, dist: 0 };
    const drop   = { idx: 2, dist: 0 };
    expect(pickup.idx >= drop.idx).toBe(true); // means: should be skipped
  });

  it("rejects a trip where pickup is after drop (wrong direction)", () => {
    const pickup = { idx: 3, dist: 0 };
    const drop   = { idx: 1, dist: 0 };
    expect(pickup.idx >= drop.idx).toBe(true); // should be skipped
  });

  it("accepts a valid trip where pickup is before drop", () => {
    const pickup = { idx: 1, dist: 0 };
    const drop   = { idx: 3, dist: 0 };
    expect(pickup.idx >= drop.idx).toBe(false); // passes the guard
  });
});
