import { describe, expect, it } from "vitest";
import { computeOccupancyPct, computeRecommendedPrice, type PricingRule } from "./engine";

function rule(overrides: Partial<PricingRule>): PricingRule {
  return {
    id: "r1",
    ruleType: "weekend",
    label: "Test rule",
    lookaheadDays: null,
    occupancyThresholdPct: null,
    minNights: null,
    maxNights: null,
    daysBeforeCheckinMax: null,
    adjustmentType: "percent",
    adjustmentValue: 0,
    priority: 0,
    isActive: true,
    ...overrides,
  };
}

const noOccupancy = () => 0;

describe("computeRecommendedPrice — base cases", () => {
  it("returns the base price untouched when no rule applies", () => {
    const result = computeRecommendedPrice([], {
      basePrice: 120,
      minPrice: null,
      maxPrice: null,
      date: "2026-09-16", // a Wednesday
      today: "2026-09-01",
      stayNights: 3,
      occupancyByLookahead: noOccupancy,
    });
    expect(result).toEqual({ price: 120, breakdown: [], cappedByMin: false, cappedByMax: false });
  });

  it("applies a percent adjustment", () => {
    const result = computeRecommendedPrice(
      [rule({ ruleType: "weekend", adjustmentType: "percent", adjustmentValue: 20, label: "Weekend" })],
      {
        basePrice: 100,
        minPrice: null,
        maxPrice: null,
        date: "2026-09-18", // a Friday
        today: "2026-09-01",
        stayNights: 2,
        occupancyByLookahead: noOccupancy,
      },
    );
    expect(result.price).toBe(120);
    expect(result.breakdown).toEqual([{ label: "Weekend", delta: 20, resultingPrice: 120 }]);
  });

  it("skips a weekend rule on a weekday", () => {
    const result = computeRecommendedPrice(
      [rule({ ruleType: "weekend", adjustmentValue: 20 })],
      {
        basePrice: 100,
        minPrice: null,
        maxPrice: null,
        date: "2026-09-16", // Wednesday
        today: "2026-09-01",
        stayNights: 2,
        occupancyByLookahead: noOccupancy,
      },
    );
    expect(result.price).toBe(100);
  });
});

describe("computeRecommendedPrice — cumulative rule stacking (matches the cahier des charges' worked example)", () => {
  it("applies +10% occupancy then +20% weekend sequentially, not additively", () => {
    const rules = [
      rule({
        ruleType: "occupancy_high",
        lookaheadDays: 30,
        occupancyThresholdPct: 70,
        adjustmentValue: 10,
        priority: 0,
        label: "Forte occupation J-30",
      }),
      rule({
        ruleType: "weekend",
        adjustmentValue: 20,
        priority: 1,
        label: "Weekend",
      }),
    ];

    const result = computeRecommendedPrice(rules, {
      basePrice: 120,
      minPrice: null,
      maxPrice: null,
      date: "2026-09-18", // Friday
      today: "2026-09-01",
      stayNights: 2,
      occupancyByLookahead: () => 75, // above the 70% threshold
    });

    // 120 -> +10% = 132 -> +20% = 158.4, NOT 120 * 1.30 = 156
    expect(result.price).toBe(158.4);
    expect(result.breakdown.map((b) => b.resultingPrice)).toEqual([132, 158.4]);
  });

  it("respects priority order, not declaration order", () => {
    const rules = [
      rule({ ruleType: "weekend", adjustmentValue: 20, priority: 1, label: "Weekend" }),
      rule({
        ruleType: "occupancy_high",
        lookaheadDays: 30,
        occupancyThresholdPct: 70,
        adjustmentValue: 10,
        priority: 0,
        label: "Occupation",
      }),
    ];

    const result = computeRecommendedPrice(rules, {
      basePrice: 120,
      minPrice: null,
      maxPrice: null,
      date: "2026-09-18",
      today: "2026-09-01",
      stayNights: 2,
      occupancyByLookahead: () => 75,
    });

    expect(result.breakdown[0].label).toBe("Occupation");
    expect(result.breakdown[1].label).toBe("Weekend");
  });
});

describe("computeRecommendedPrice — min/max caps", () => {
  it("floors the price at min_price and reports it was capped", () => {
    const result = computeRecommendedPrice(
      [rule({ ruleType: "last_minute", daysBeforeCheckinMax: 3, adjustmentValue: -50, label: "Last minute" })],
      {
        basePrice: 100,
        minPrice: 60,
        maxPrice: null,
        date: "2026-09-02",
        today: "2026-09-01",
        stayNights: 1,
        occupancyByLookahead: noOccupancy,
      },
    );
    expect(result.price).toBe(60);
    expect(result.cappedByMin).toBe(true);
  });

  it("ceilings the price at max_price and reports it was capped", () => {
    const result = computeRecommendedPrice(
      [rule({ ruleType: "weekend", adjustmentValue: 200, label: "Big weekend bump" })],
      {
        basePrice: 100,
        minPrice: null,
        maxPrice: 250,
        date: "2026-09-18",
        today: "2026-09-01",
        stayNights: 2,
        occupancyByLookahead: noOccupancy,
      },
    );
    expect(result.price).toBe(250);
    expect(result.cappedByMax).toBe(true);
  });
});

describe("computeRecommendedPrice — length of stay and last minute", () => {
  it("applies a length-of-stay discount only within its night range", () => {
    const weekLongDiscount = rule({
      ruleType: "length_of_stay",
      minNights: 7,
      maxNights: null,
      adjustmentValue: -10,
      label: "Séjour long",
    });

    const shortStay = computeRecommendedPrice([weekLongDiscount], {
      basePrice: 100,
      minPrice: null,
      maxPrice: null,
      date: "2026-09-16",
      today: "2026-09-01",
      stayNights: 3,
      occupancyByLookahead: noOccupancy,
    });
    expect(shortStay.price).toBe(100);

    const longStay = computeRecommendedPrice([weekLongDiscount], {
      basePrice: 100,
      minPrice: null,
      maxPrice: null,
      date: "2026-09-16",
      today: "2026-09-01",
      stayNights: 7,
      occupancyByLookahead: noOccupancy,
    });
    expect(longStay.price).toBe(90);
  });

  it("only applies last-minute pricing inside the check-in window, and never for a past date", () => {
    const lastMinute = rule({
      ruleType: "last_minute",
      daysBeforeCheckinMax: 2,
      adjustmentValue: -15,
      label: "Dernière minute",
    });

    const withinWindow = computeRecommendedPrice([lastMinute], {
      basePrice: 100,
      minPrice: null,
      maxPrice: null,
      date: "2026-09-03",
      today: "2026-09-01",
      stayNights: 1,
      occupancyByLookahead: noOccupancy,
    });
    expect(withinWindow.price).toBe(85);

    const tooFarOut = computeRecommendedPrice([lastMinute], {
      basePrice: 100,
      minPrice: null,
      maxPrice: null,
      date: "2026-09-10",
      today: "2026-09-01",
      stayNights: 1,
      occupancyByLookahead: noOccupancy,
    });
    expect(tooFarOut.price).toBe(100);
  });
});

describe("computeOccupancyPct", () => {
  it("returns 0 for no bookings", () => {
    expect(computeOccupancyPct(new Set(), "2026-09-01", 10)).toBe(0);
  });

  it("returns 100 when every night in the window is booked", () => {
    const booked = new Set(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(computeOccupancyPct(booked, "2026-09-01", 3)).toBe(100);
  });

  it("computes a partial percentage", () => {
    const booked = new Set(["2026-09-01", "2026-09-03"]);
    expect(computeOccupancyPct(booked, "2026-09-01", 4)).toBe(50);
  });
});
