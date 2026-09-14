// Minimal RFC 5545 (iCalendar) reader/writer, scoped to exactly what OTA
// export feeds actually use: flat VEVENT blocks with UID/DTSTART/DTEND/SUMMARY,
// all-day dates, no recurrence, no timezones. Airbnb, Vrbo and Booking.com
// export feeds all fit this shape. A full RFC 5545 parser is far more than
// this needs — pulling in a dependency for it would carry more surface
// (and more to audit) than writing the ~10 lines this actually requires.

export type IcalEvent = {
  uid: string;
  /** YYYY-MM-DD, inclusive */
  start: string;
  /** YYYY-MM-DD, exclusive (matches our own check_out / block end convention) */
  end: string;
  summary: string;
};

export function parseIcalEvents(icsText: string): IcalEvent[] {
  // RFC 5545 line folding: a line starting with a space or tab continues
  // the previous line. Unfold before splitting into logical lines.
  const unfolded = icsText.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");

  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.uid && current.start && current.end) {
        events.push({
          uid: current.uid,
          start: current.start,
          end: current.end,
          summary: current.summary ?? "Réservé",
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const property = key.split(";")[0];

    if (property === "UID") current.uid = value;
    else if (property === "SUMMARY") current.summary = unescapeText(value);
    else if (property === "DTSTART") current.start = toIsoDate(value);
    else if (property === "DTEND") current.end = toIsoDate(value);
  }

  return events;
}

function toIsoDate(value: string): string {
  // Accepts "20260920" (all-day) or "20260920T140000Z" (date-time) —
  // OTA feeds mix both depending on the platform. We only ever need the
  // calendar date, never the time of day.
  const digits = value.replace(/[^0-9]/g, "");
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function unescapeText(value: string): string {
  return value.replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Builds a minimal, valid .ics feed for our own outgoing export. */
export function buildIcal(
  events: { uid: string; start: string; end: string; summary: string }[],
  calendarName: string,
): string {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Channel Manager//FR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escape(calendarName)}`,
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${event.start.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${event.end.replace(/-/g, "")}`,
      `SUMMARY:${escape(event.summary)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
