// Pure pricing computation — no Supabase, no fetch. The page that calls
// this is responsible for loading rules and occupancy data; keeping the
// arithmetic itself free of I/O is what makes it possible to unit-test the
// one part of this feature that absolutely must not silently drift (a
// wrong price is a wrong price, whether or not anyone notices right away).

import { addDays, daysBetween } from "@/lib/calendar";

export type PricingRuleType =
  | "weekend"
  | "occupancy_high"
  | "occupancy_low"
  | "length_of_stay"
  | "last_minute";

export type PricingRule = {
  id: string;
  ruleType: PricingRuleType;
  label: string;
  lookaheadDays: number | null;
  occupancyThresholdPct: number | null;
  minNights: number | null;
  maxNights: number | null;
  daysBeforeCheckinMax: number | null;
  adjustmentType: "percent" | "fixed";
  adjustmentValue: number;
  priority: number;
  isActive: boolean;
};

export type PricingContext = {
  basePrice: number;
  minPrice: number | null;
  maxPrice: number | null;
  /** The night being priced, YYYY-MM-DD. */
  date: string;
  /** "Now", YYYY-MM-DD — how far out `date` is determines last-minute rules. */
  today: string;
  /** Length of the candidate stay this night belongs to, for length-of-stay rules. */
  stayNights: number;
  /** 0-100 booked-nights percentage over the `lookaheadDays` window starting at `date`. */
  occupancyByLookahead: (lookaheadDays: number) => number;
};

export type PriceBreakdownLine = { label: string; delta: number; resultingPrice: number };

export type PriceRecommendation = {
  price: number;
  breakdown: PriceBreakdownLine[];
  cappedByMin: boolean;
  cappedByMax: boolean;
};

export function computeRecommendedPrice(
  rules: PricingRule[],
  ctx: PricingContext,
): PriceRecommendation {
  let price = ctx.basePrice;
  const breakdown: PriceBreakdownLine[] = [];

  const applicable = rules
    .filter((rule) => rule.isActive && ruleApplies(rule, ctx))
    .sort((a, b) => a.priority - b.priority);

  for (const rule of applicable) {
    const before = price;
    price = rule.adjustmentType === "percent" ? price * (1 + rule.adjustmentValue / 100) : price + rule.adjustmentValue;
    breakdown.push({ label: rule.label, delta: price - before, resultingPrice: price });
  }

  let cappedByMin = false;
  let cappedByMax = false;
  if (ctx.minPrice != null && price < ctx.minPrice) {
    price = ctx.minPrice;
    cappedByMin = true;
  }
  if (ctx.maxPrice != null && price > ctx.maxPrice) {
    price = ctx.maxPrice;
    cappedByMax = true;
  }

  return { price: Math.round(price * 100) / 100, breakdown, cappedByMin, cappedByMax };
}

function ruleApplies(rule: PricingRule, ctx: PricingContext): boolean {
  switch (rule.ruleType) {
    case "weekend": {
      // getUTCDay(): 0=Sunday ... 5=Friday, 6=Saturday.
      const day = new Date(`${ctx.date}T00:00:00Z`).getUTCDay();
      return day === 5 || day === 6;
    }
    case "occupancy_high":
      if (rule.lookaheadDays == null || rule.occupancyThresholdPct == null) return false;
      return ctx.occupancyByLookahead(rule.lookaheadDays) > rule.occupancyThresholdPct;
    case "occupancy_low":
      if (rule.lookaheadDays == null || rule.occupancyThresholdPct == null) return false;
      return ctx.occupancyByLookahead(rule.lookaheadDays) < rule.occupancyThresholdPct;
    case "length_of_stay": {
      const min = rule.minNights ?? 0;
      const max = rule.maxNights ?? Infinity;
      return ctx.stayNights >= min && ctx.stayNights <= max;
    }
    case "last_minute": {
      if (rule.daysBeforeCheckinMax == null) return false;
      const days = daysBetween(ctx.today, ctx.date);
      return days >= 0 && days <= rule.daysBeforeCheckinMax;
    }
  }
}

/**
 * 0-100 percentage of nights in [from, from+lookaheadDays) present in
 * `bookedDates`. Pure so it can be reused identically by the engine's
 * `occupancyByLookahead` callback and by tests.
 */
export function computeOccupancyPct(
  bookedDates: ReadonlySet<string>,
  from: string,
  lookaheadDays: number,
): number {
  if (lookaheadDays <= 0) return 0;
  let booked = 0;
  for (let i = 0; i < lookaheadDays; i++) {
    if (bookedDates.has(addDays(from, i))) booked++;
  }
  return (booked / lookaheadDays) * 100;
}
