// Pure date-grid logic for the multi-unit calendar view (src/app/org/[slug]/calendar).
// Dates are plain "YYYY-MM-DD" strings throughout — that format sorts and
// compares correctly with ordinary string operators, which is why nothing
// here needs a date library or timezone handling beyond UTC-anchored Date
// objects for day arithmetic.

export type CalendarEventType = "reservation" | "block";

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  startDate: string; // inclusive
  endDate: string; // exclusive (checkout / block end date)
  label: string;
  sublabel?: string;
  href?: string;
};

export type CalendarCell =
  | { kind: "available"; date: string }
  | { kind: "event"; event: CalendarEvent; nights: number };

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** First day of the given "YYYY-MM" month, and the first day of the next month (exclusive end). */
export function monthRange(month: string): { start: string; end: string; daysInMonth: number } {
  const [year, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const end = addDays(start, daysInMonth);
  return { start, end, daysInMonth };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Turns a unit's events for one month into an ordered row of cells —
 * available-day cells and merged event bars (one cell per event, spanning
 * `nights` columns), clipped to the visible month. Events must not overlap
 * each other within a unit (the database guarantees this for reservations;
 * blocks are similarly non-overlapping by the calendar_blocks_no_overlap
 * constraint) — the two lists are merged and sorted here since reservations
 * and blocks live in separate tables.
 */
export function buildUnitRow(
  monthStart: string,
  monthEnd: string,
  events: CalendarEvent[],
): CalendarCell[] {
  const sorted = [...events].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const cells: CalendarCell[] = [];
  let cursor = monthStart;

  for (const event of sorted) {
    const clippedStart = event.startDate < monthStart ? monthStart : event.startDate;
    const clippedEnd = event.endDate > monthEnd ? monthEnd : event.endDate;
    if (clippedEnd <= cursor) continue;

    fillAvailable(cells, cursor, clippedStart);

    const nights = daysBetween(clippedStart, clippedEnd);
    if (nights > 0) {
      cells.push({ kind: "event", event, nights });
      cursor = clippedEnd;
    }
  }

  fillAvailable(cells, cursor, monthEnd);
  return cells;
}

function fillAvailable(cells: CalendarCell[], from: string, to: string) {
  let d = from;
  while (d < to) {
    cells.push({ kind: "available", date: d });
    d = addDays(d, 1);
  }
}
