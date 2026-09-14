// Pure comp-set statistics — spec section 10's worked example (14
// septembre: A=145, B=155, C=165, moyenne=155, mon logement=150,
// positionnement=-3,2%) is reproduced exactly in compset.test.ts.

export type CompSetStats = {
  count: number;
  average: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
};

export function computeCompSetStats(prices: number[]): CompSetStats | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, p) => acc + p, 0);

  return {
    count: sorted.length,
    average: round2(sum / sorted.length),
    median: round2(percentile(sorted, 50)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25: round2(percentile(sorted, 25)),
    p75: round2(percentile(sorted, 75)),
  };
}

/** % difference of `myPrice` vs `average` — negative means priced below the comp set. */
export function computePositioningPct(myPrice: number, average: number): number {
  if (average === 0) return 0;
  return round2(((myPrice - average) / average) * 100);
}

// Linear-interpolation percentile (same method spreadsheets default to),
// on an already-sorted array.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
