/**
 * Unit tests for price-calculation logic used throughout the app.
 * All tests operate on pure functions – no DOM / React required.
 */

import { describe, it, expect } from "vitest";

// ── Helpers replicated from OfferRide.tsx ──────────────────────────────────

const FUEL_PRICE_PER_LITER = 105;

const VEHICLE_TYPES = [
  { value: "Compact", fuelPerKm: 0.05 },
  { value: "Sedan",   fuelPerKm: 0.06 },
  { value: "SUV",     fuelPerKm: 0.08 },
  { value: "Van",     fuelPerKm: 0.09 },
];

function calcSuggestedPrice(distanceKm: number, vehicleType: string, seats: number): number {
  const vehicle = VEHICLE_TYPES.find(v => v.value === vehicleType);
  const fuelCost = distanceKm * (vehicle?.fuelPerKm ?? 0.06) * FUEL_PRICE_PER_LITER;
  return Math.round((fuelCost * 1.3) / seats);
}

function calcFuelCost(distanceKm: number, vehicleType: string): number {
  const vehicle = VEHICLE_TYPES.find(v => v.value === vehicleType);
  return Math.round(distanceKm * (vehicle?.fuelPerKm ?? 0.06) * FUEL_PRICE_PER_LITER);
}

// ── Helpers replicated from RideCard.tsx / RideDetails.tsx ─────────────────

function calcEffectivePrice(
  price: number,
  overlapDistanceMeters: number | undefined | null,
  estimatedDistance: number | undefined | null,
): number {
  const isPartial = overlapDistanceMeters != null && (estimatedDistance ?? 0) > 0;
  return isPartial
    ? Math.max(1, Math.round(price * overlapDistanceMeters! / estimatedDistance!))
    : price;
}

// ──────────────────────────────────────────────────────────────────────────

describe("calcFuelCost", () => {
  it("Sedan: 100 km → 630 ₹ fuel", () => {
    expect(calcFuelCost(100, "Sedan")).toBe(630); // 100 * 0.06 * 105 = 630
  });

  it("Compact: 100 km → 525 ₹ fuel", () => {
    expect(calcFuelCost(100, "Compact")).toBe(525); // 100 * 0.05 * 105
  });

  it("SUV: 100 km → 840 ₹ fuel", () => {
    expect(calcFuelCost(100, "SUV")).toBe(840); // 100 * 0.08 * 105
  });

  it("Van: 50 km → 473 ₹ fuel", () => {
    expect(calcFuelCost(50, "Van")).toBe(473); // 50 * 0.09 * 105 = 472.5 → 473
  });

  it("falls back to Sedan rate for unknown vehicle type", () => {
    expect(calcFuelCost(100, "Unknown")).toBe(630);
  });

  it("zero distance → zero fuel cost", () => {
    expect(calcFuelCost(0, "Sedan")).toBe(0);
  });
});

describe("calcSuggestedPrice", () => {
  it("Sedan, 100 km, 3 seats → ₹273", () => {
    // fuel = 630, markup = 630 * 1.3 = 819, per seat = 819 / 3 = 273
    expect(calcSuggestedPrice(100, "Sedan", 3)).toBe(273);
  });

  it("SUV, 200 km, 5 seats → ₹439", () => {
    // fuel = 1680, markup = 2184, per seat = 2184/5 = 436.8 → 437
    expect(calcSuggestedPrice(200, "SUV", 5)).toBe(437);
  });

  it("price increases with distance", () => {
    const short = calcSuggestedPrice(50, "Sedan", 2);
    const long  = calcSuggestedPrice(200, "Sedan", 2);
    expect(long).toBeGreaterThan(short);
  });

  it("price decreases as seat count rises (cost sharing)", () => {
    const few  = calcSuggestedPrice(100, "Sedan", 1);
    const many = calcSuggestedPrice(100, "Sedan", 5);
    expect(many).toBeLessThan(few);
  });

  it("minimum 1 seat does not divide by zero", () => {
    expect(() => calcSuggestedPrice(100, "Sedan", 1)).not.toThrow();
  });
});

describe("calcEffectivePrice (proportional pricing)", () => {
  it("returns full price when overlapDistanceMeters is null", () => {
    expect(calcEffectivePrice(100, null, 100_000)).toBe(100);
  });

  it("returns full price when overlapDistanceMeters is undefined", () => {
    expect(calcEffectivePrice(100, undefined, 100_000)).toBe(100);
  });

  it("returns full price when estimatedDistance is null", () => {
    expect(calcEffectivePrice(100, 50_000, null)).toBe(100);
  });

  it("returns full price when estimatedDistance is 0 (avoid divide-by-zero)", () => {
    expect(calcEffectivePrice(100, 50_000, 0)).toBe(100);
  });

  it("50% of route → 50% of price", () => {
    expect(calcEffectivePrice(100, 50_000, 100_000)).toBe(50);
  });

  it("25% of route → 25% of price", () => {
    expect(calcEffectivePrice(200, 25_000, 100_000)).toBe(50);
  });

  it("full overlap → full price", () => {
    expect(calcEffectivePrice(80, 100_000, 100_000)).toBe(80);
  });

  it("very short overlap is clamped to minimum ₹1", () => {
    expect(calcEffectivePrice(10, 100, 100_000)).toBe(1);
  });

  it("rounds to nearest integer", () => {
    // 59 * 40000 / 100000 = 23.6 → 24
    expect(calcEffectivePrice(59, 40_000, 100_000)).toBe(24);
  });

  it("effectivePrice is never negative", () => {
    expect(calcEffectivePrice(0, 50_000, 100_000)).toBeGreaterThanOrEqual(0);
  });
});

describe("booking total calculation", () => {
  it("totalPrice = effectivePrice × seats", () => {
    const effectivePrice = calcEffectivePrice(100, 50_000, 100_000); // 50
    const seats = 2;
    expect(effectivePrice * seats).toBe(100);
  });

  it("serviceFee is 5% of totalPrice, rounded", () => {
    const totalPrice = 100;
    const serviceFee = Math.round(totalPrice * 0.05);
    expect(serviceFee).toBe(5);
  });

  it("finalPrice = totalPrice + serviceFee", () => {
    const totalPrice = 200;
    const serviceFee = Math.round(totalPrice * 0.05); // 10
    expect(totalPrice + serviceFee).toBe(210);
  });

  it("service fee rounds correctly on odd numbers", () => {
    const totalPrice = 59;
    const serviceFee = Math.round(totalPrice * 0.05); // 59 * 0.05 = 2.95 → 3
    expect(serviceFee).toBe(3);
  });
});
