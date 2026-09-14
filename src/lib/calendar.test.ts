import { describe, expect, it } from "vitest";
import { addDays, buildUnitRow, daysBetween, monthRange, shiftMonth } from "./calendar";

describe("addDays / daysBetween", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-09-29", 3)).toBe("2026-10-02");
  });

  it("counts nights between two dates", () => {
    expect(daysBetween("2026-09-20", "2026-09-23")).toBe(3);
  });
});

describe("monthRange", () => {
  it("computes start, end and day count for a 30-day month", () => {
    expect(monthRange("2026-09")).toEqual({
      start: "2026-09-01",
      end: "2026-10-01",
      daysInMonth: 30,
    });
  });

  it("handles February in a leap year", () => {
    expect(monthRange("2028-02").daysInMonth).toBe(29);
  });
});

describe("shiftMonth", () => {
  it("rolls over into the next year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("rolls back into the previous year", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("buildUnitRow — this is what draws the calendar grid", () => {
  it("returns one available cell per day when there are no events", () => {
    const cells = buildUnitRow("2026-09-01", "2026-09-04", []);
    expect(cells).toEqual([
      { kind: "available", date: "2026-09-01" },
      { kind: "available", date: "2026-09-02" },
      { kind: "available", date: "2026-09-03" },
    ]);
  });

  it("merges a reservation into a single spanning cell", () => {
    const cells = buildUnitRow("2026-09-01", "2026-09-10", [
      {
        id: "r1",
        type: "reservation",
        startDate: "2026-09-03",
        endDate: "2026-09-06",
        label: "Jean Dupont",
      },
    ]);

    expect(cells).toEqual([
      { kind: "available", date: "2026-09-01" },
      { kind: "available", date: "2026-09-02" },
      {
        kind: "event",
        nights: 3,
        event: {
          id: "r1",
          type: "reservation",
          startDate: "2026-09-03",
          endDate: "2026-09-06",
          label: "Jean Dupont",
        },
      },
      { kind: "available", date: "2026-09-06" },
      { kind: "available", date: "2026-09-07" },
      { kind: "available", date: "2026-09-08" },
      { kind: "available", date: "2026-09-09" },
    ]);
  });

  it("clips an event that starts before the visible month", () => {
    const cells = buildUnitRow("2026-09-01", "2026-09-05", [
      { id: "r1", type: "reservation", startDate: "2026-08-28", endDate: "2026-09-03", label: "X" },
    ]);

    expect(cells[0]).toEqual({
      kind: "event",
      nights: 2, // only Sep 1-2 are in the visible month
      event: { id: "r1", type: "reservation", startDate: "2026-08-28", endDate: "2026-09-03", label: "X" },
    });
  });

  it("clips an event that ends after the visible month", () => {
    const cells = buildUnitRow("2026-09-01", "2026-09-05", [
      { id: "r1", type: "reservation", startDate: "2026-09-03", endDate: "2026-09-20", label: "X" },
    ]);

    const eventCell = cells.find((c) => c.kind === "event");
    expect(eventCell).toMatchObject({ nights: 2 }); // Sep 3-4 only
  });

  it("places back-to-back events (checkout day == check-in day) as adjacent cells, not overlapping", () => {
    const cells = buildUnitRow("2026-09-01", "2026-09-10", [
      { id: "a", type: "reservation", startDate: "2026-09-02", endDate: "2026-09-05", label: "A" },
      { id: "b", type: "block", startDate: "2026-09-05", endDate: "2026-09-07", label: "B" },
    ]);

    const eventCells = cells.filter((c) => c.kind === "event");
    expect(eventCells).toHaveLength(2);
    expect(eventCells[0]).toMatchObject({ nights: 3, event: { id: "a" } });
    expect(eventCells[1]).toMatchObject({ nights: 2, event: { id: "b" } });
  });
});
