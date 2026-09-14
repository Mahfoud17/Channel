import { describe, expect, it } from "vitest";
import { computeCompSetStats, computePositioningPct } from "./compset";

describe("computeCompSetStats — spec section 10's worked example", () => {
  // "14 septembre : Concurrent A = 145 €, B = 155 €, C = 165 €, Mon
  // logement = 150 €, Moyenne = 155 €, Positionnement = -3,2 %"
  it("matches the cahier des charges exactly", () => {
    const stats = computeCompSetStats([145, 155, 165]);
    expect(stats?.average).toBe(155);
    expect(computePositioningPct(150, stats!.average)).toBe(-3.23);
  });

  it("returns null for an empty comp set rather than dividing by zero", () => {
    expect(computeCompSetStats([])).toBeNull();
  });

  it("computes min/max/median for a single competitor", () => {
    const stats = computeCompSetStats([200]);
    expect(stats).toMatchObject({ count: 1, average: 200, median: 200, min: 200, max: 200 });
  });

  it("computes quartiles for a larger comp set", () => {
    const stats = computeCompSetStats([100, 120, 140, 160, 180]);
    expect(stats).toMatchObject({ min: 100, max: 180, median: 140 });
  });
});

describe("computePositioningPct", () => {
  it("is positive when priced above the comp set average", () => {
    expect(computePositioningPct(180, 150)).toBe(20);
  });

  it("is negative when priced below", () => {
    expect(computePositioningPct(120, 150)).toBe(-20);
  });

  it("is zero when priced exactly at the average", () => {
    expect(computePositioningPct(150, 150)).toBe(0);
  });
});
