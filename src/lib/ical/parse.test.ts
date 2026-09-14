import { describe, expect, it } from "vitest";
import { buildIcal, parseIcalEvents } from "./parse";

describe("parseIcalEvents", () => {
  it("parses a minimal all-day VEVENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:abc-123@airbnb.com",
      "DTSTART;VALUE=DATE:20260920",
      "DTEND;VALUE=DATE:20260923",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcalEvents(ics)).toEqual([
      { uid: "abc-123@airbnb.com", start: "2026-09-20", end: "2026-09-23", summary: "Reserved" },
    ]);
  });

  it("parses multiple events and a date-time DTSTART", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:one",
      "DTSTART:20260901T140000Z",
      "DTEND:20260903T110000Z",
      "SUMMARY:Booking.com (Not available)",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:two",
      "DTSTART;VALUE=DATE:20261001",
      "DTEND;VALUE=DATE:20261005",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcalEvents(ics);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      uid: "one",
      start: "2026-09-01",
      end: "2026-09-03",
      summary: "Booking.com (Not available)",
    });
    // No SUMMARY on the second event — falls back to a default rather than
    // producing an undefined label the UI would render as "undefined".
    expect(events[1].summary).toBe("Réservé");
  });

  it("unfolds continuation lines per RFC 5545", () => {
    // The single leading space on a continuation line IS the fold marker
    // and is removed as part of unfolding — a real content space at the
    // fold point needs a *second* space to survive (RFC 5545 §3.1).
    const ics = [
      "BEGIN:VEVENT",
      "UID:folded",
      "SUMMARY:A very long summary that got wrapped",
      "  onto a second physical line by the exporter",
      "DTSTART;VALUE=DATE:20260910",
      "DTEND;VALUE=DATE:20260912",
      "END:VEVENT",
    ].join("\r\n");

    const [event] = parseIcalEvents(ics);
    expect(event.summary).toBe("A very long summary that got wrapped onto a second physical line by the exporter");
  });

  it("ignores an event missing a UID (can't be reconciled later, so it must not be imported)", () => {
    const ics = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260910",
      "DTEND;VALUE=DATE:20260912",
      "END:VEVENT",
    ].join("\r\n");

    expect(parseIcalEvents(ics)).toEqual([]);
  });

  it("returns nothing for an empty feed", () => {
    expect(parseIcalEvents("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toEqual([]);
  });
});

describe("buildIcal", () => {
  it("produces a feed parseIcalEvents can read back losslessly", () => {
    const source = [
      { uid: "r1@channel-manager", start: "2026-09-20", end: "2026-09-23", summary: "Réservé" },
      { uid: "r2@channel-manager", start: "2026-10-01", end: "2026-10-02", summary: "Réservé" },
    ];

    const ics = buildIcal(source, "Cocon");
    const roundTripped = parseIcalEvents(ics);

    expect(roundTripped).toEqual(source);
  });

  it("escapes commas and semicolons in the calendar name", () => {
    const ics = buildIcal([], "Lyon, Presqu'île; Centre");
    expect(ics).toContain("X-WR-CALNAME:Lyon\\, Presqu'île\\; Centre");
  });
});
