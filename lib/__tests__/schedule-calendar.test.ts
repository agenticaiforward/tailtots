import { describe, expect, it } from "vitest";

import {
  dayAbbrevForDate,
  eventToBusySlotKeys,
  expandSlotLabel,
  formatEventWhen,
  formatHourLabel,
  formatTime12,
  isCanonicalSlotKey,
  mergeSlotKeys,
  parseIcs,
  parseSlotKey,
  slotKey,
  slotKeyLabel,
  GRID_END_HOUR,
  GRID_START_HOUR,
} from "../schedule-calendar";

/* ------------------------------------------------------------------ */
/* Slot keys                                                           */
/* ------------------------------------------------------------------ */

describe("slot keys", () => {
  it("round-trips through parseSlotKey", () => {
    expect(parseSlotKey(slotKey("Mon", 16, 0))).toEqual({ day: "Mon", hour: 16, minute: 0 });
    expect(parseSlotKey(slotKey("Sun", 8, 45))).toEqual({ day: "Sun", hour: 8, minute: 45 });
    expect(parseSlotKey("Mon|16:07")).toBeNull(); // not on a 15-min boundary
    expect(parseSlotKey("Tuesday 4:30–6:00 PM")).toBeNull(); // legacy label
    expect(parseSlotKey("nope")).toBeNull();
  });

  it("distinguishes canonical keys from legacy labels", () => {
    expect(isCanonicalSlotKey("Mon|16:00")).toBe(true);
    expect(isCanonicalSlotKey("Tuesday 4:30–6:00 PM")).toBe(false);
    expect(isCanonicalSlotKey("Sunday afternoon")).toBe(false);
  });

  it("formats human labels", () => {
    expect(slotKeyLabel("Mon|16:00")).toBe("Mon 4:00 PM");
    expect(slotKeyLabel("Sat|09:15")).toBe("Sat 9:15 AM");
    expect(slotKeyLabel("Sun|12:00")).toBe("Sun 12:00 PM");
    expect(formatHourLabel(7)).toBe("7 AM");
    expect(formatHourLabel(20)).toBe("8 PM");
    expect(formatTime12(0, 30)).toBe("12:30 AM");
  });

  it("merges adjacent keys into range labels", () => {
    expect(mergeSlotKeys(["Mon|16:00", "Mon|16:15", "Mon|16:30", "Mon|16:45"])).toEqual([
      "Mon 4:00–5:00 PM",
    ]);
    expect(mergeSlotKeys(["Tue|09:00"])).toEqual(["Tue 9:00 AM"]);
    // Non-adjacent keys split into separate ranges, days stay in Mon..Sun order.
    expect(mergeSlotKeys(["Sun|10:00", "Mon|16:00", "Mon|18:00"])).toEqual([
      "Mon 4:00 PM",
      "Mon 6:00 PM",
      "Sun 10:00 AM",
    ]);
    // Dedupes and ignores junk.
    expect(mergeSlotKeys(["Mon|16:00", "Mon|16:00", "junk"])).toEqual(["Mon 4:00 PM"]);
    expect(mergeSlotKeys([])).toEqual([]);
  });

  it("expands merged range labels back to keys", () => {
    expect(expandSlotLabel("Mon 4:00–5:00 PM")).toEqual([
      "Mon|16:00",
      "Mon|16:15",
      "Mon|16:30",
      "Mon|16:45",
    ]);
    expect(expandSlotLabel("Tue 9:00 AM")).toEqual(["Tue|09:00"]);
    expect(expandSlotLabel("Mon|16:00")).toEqual(["Mon|16:00"]);
  });

  it("expands legacy labels from earlier builds", () => {
    expect(expandSlotLabel("Tuesday 4:30–6:00 PM")).toEqual([
      "Tue|16:30",
      "Tue|16:45",
      "Tue|17:00",
      "Tue|17:15",
      "Tue|17:30",
      "Tue|17:45",
    ]);
    expect(expandSlotLabel("Saturday 10:00 AM–12:00 PM")).toEqual([
      "Sat|10:00",
      "Sat|10:15",
      "Sat|10:30",
      "Sat|10:45",
      "Sat|11:00",
      "Sat|11:15",
      "Sat|11:30",
      "Sat|11:45",
    ]);
    // Unparseable legacy labels pass through literally.
    expect(expandSlotLabel("Sunday afternoon")).toEqual(["Sunday afternoon"]);
  });

  it("merge → expand round-trips", () => {
    const keys = ["Wed|15:00", "Wed|15:15", "Wed|15:30", "Fri|18:00"];
    const merged = mergeSlotKeys(keys);
    expect(merged).toEqual(["Wed 3:00–3:45 PM", "Fri 6:00 PM"]);
    expect(merged.flatMap(expandSlotLabel).sort()).toEqual([...keys].sort());
  });
});

/* ------------------------------------------------------------------ */
/* ICS parsing                                                         */
/* ------------------------------------------------------------------ */

// Crafted sample .ics: Oct 12 2026 is a Monday (Oct 6 2026 = Tuesday).
const SAMPLE_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//TailTots Test//EN",
  "BEGIN:VEVENT",
  "UID:evt-utc-1",
  "DTSTAMP:20261001T120000Z",
  "DTSTART:20261012T160000Z",
  "DTEND:20261012T170000Z",
  "SUMMARY:Swim practice",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-tzid-2",
  "DTSTAMP:20261001T120000Z",
  "DTSTART;TZID=America/Chicago:20261014T153000",
  "DTEND;TZID=America/Chicago:20261014T163000",
  "RRULE:FREQ=WEEKLY",
  "SUMMARY:Soccer practice",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-allday-3",
  "DTSTAMP:20261001T120000Z",
  "DTSTART;VALUE=DATE:20261015",
  "SUMMARY:No-school day",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-duration-4",
  "DTSTAMP:20261001T120000Z",
  "DTSTART:20261016T090000",
  "DURATION:PT45M",
  "SUMMARY:Dentist appointment",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-bad-5",
  "DTSTAMP:20261001T120000Z",
  "SUMMARY:Missing DTSTART is skipped",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

describe("parseIcs", () => {
  it("parses UTC, TZID, all-day, and DURATION events; skips malformed ones", () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events).toHaveLength(4);

    const swim = events.find((e) => e.uid === "evt-utc-1")!;
    expect(swim.summary).toBe("Swim practice");
    expect(swim.allDay).toBe(false);
    expect(swim.recurringWeekly).toBe(false);
    // Instant assertions are timezone-independent: 16:00Z on Monday Oct 12.
    expect(swim.start.getTime()).toBe(Date.UTC(2026, 9, 12, 16, 0));
    expect(swim.end.getTime()).toBe(Date.UTC(2026, 9, 12, 17, 0));

    const soccer = events.find((e) => e.uid === "evt-tzid-2")!;
    expect(soccer.summary).toBe("Soccer practice");
    expect(soccer.recurringWeekly).toBe(true);
    // 3:30 PM America/Chicago (CDT, UTC-5) = 20:30Z — the TZID conversion
    // must land on this exact instant whatever the test machine's TZ is.
    expect(soccer.start.getTime()).toBe(Date.UTC(2026, 9, 14, 20, 30));
    expect(soccer.end.getTime()).toBe(Date.UTC(2026, 9, 14, 21, 30));

    const noSchool = events.find((e) => e.uid === "evt-allday-3")!;
    expect(noSchool.allDay).toBe(true);
    // All-day DATE values are local midnights, so the local weekday is stable.
    expect(noSchool.weekday).toBe("Thu"); // Oct 15 2026
    expect(noSchool.end.getTime() - noSchool.start.getTime()).toBe(24 * 60 * 60 * 1000);

    const dentist = events.find((e) => e.uid === "evt-duration-4")!;
    expect(dentist.summary).toBe("Dentist appointment");
    expect(dentist.weekday).toBe("Fri"); // Oct 16 2026
    expect(dentist.end.getTime() - dentist.start.getTime()).toBe(45 * 60 * 1000);
  });

  it("returns [] for empty or garbage input without throwing", () => {
    expect(parseIcs("")).toEqual([]);
    expect(parseIcs("not a calendar at all")).toEqual([]);
    expect(parseIcs("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toEqual([]);
  });

  it("unfolds long lines (e.g. a wrapped SUMMARY)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:fold-1",
      "DTSTART:20261012T160000Z",
      "DTEND:20261012T170000Z",
      "SUMMARY:Very long title that got ",
      " folded onto the next line",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Very long title that got folded onto the next line");
  });
});

describe("eventToBusySlotKeys", () => {
  // Synthetic events built with the local-time Date constructor: whatever
  // the test machine's timezone, "local 4:00 PM" is local 4:00 PM, so the
  // expected keys are deterministic.
  const localEvent = (y: number, mo: number, d: number, sh: number, sm: number, eh: number, em: number) => {
    const start = new Date(y, mo, d, sh, sm);
    return {
      uid: "syn",
      summary: "synthetic",
      start,
      end: new Date(y, mo, d, eh, em),
      allDay: false,
      recurringWeekly: false,
      weekday: dayAbbrevForDate(start),
    };
  };

  it("maps a 1-hour event to four 15-minute keys on the right weekday", () => {
    // Monday Oct 12 2026, local 4:00–5:00 PM.
    const keys = eventToBusySlotKeys(localEvent(2026, 9, 12, 16, 0, 17, 0));
    expect(keys.sort()).toEqual(["Mon|16:00", "Mon|16:15", "Mon|16:30", "Mon|16:45"]);
  });

  it("maps a partial-hour event to the overlapped quarters", () => {
    // Wednesday Oct 14 2026, local 3:30–4:30 PM.
    const keys = eventToBusySlotKeys(localEvent(2026, 9, 14, 15, 30, 16, 30));
    expect(keys.sort()).toEqual(["Wed|15:30", "Wed|15:45", "Wed|16:00", "Wed|16:15"]);
  });

  it("maps an all-day event to the whole grid day", () => {
    const [noSchool] = parseIcs(SAMPLE_ICS).filter((e) => e.uid === "evt-allday-3");
    const keys = eventToBusySlotKeys(noSchool);
    const expectedCount = (GRID_END_HOUR - GRID_START_HOUR + 1) * 4;
    expect(keys).toHaveLength(expectedCount);
    expect(keys.every((k) => k.startsWith("Thu|"))).toBe(true);
    expect(keys).toContain("Thu|07:00");
    expect(keys).toContain("Thu|20:45");
  });

  it("maps a 45-minute event to three keys", () => {
    // Friday Oct 16 2026, local 9:00–9:45 AM.
    const keys = eventToBusySlotKeys(localEvent(2026, 9, 16, 9, 0, 9, 45));
    expect(keys.sort()).toEqual(["Fri|09:00", "Fri|09:15", "Fri|09:30"]);
  });

  it("clips events outside grid hours", () => {
    const keys = eventToBusySlotKeys(localEvent(2026, 9, 12, 22, 0, 23, 0));
    expect(keys).toEqual([]);
  });

  it("splits multi-day events across weekdays", () => {
    // Monday 8:00 PM → Tuesday 8:00 AM local.
    const start = new Date(2026, 9, 12, 20, 0);
    const event = {
      uid: "multi",
      summary: "overnight",
      start,
      end: new Date(2026, 9, 13, 8, 0),
      allDay: false,
      recurringWeekly: false,
      weekday: dayAbbrevForDate(start),
    };
    const keys = eventToBusySlotKeys(event);
    expect(keys).toContain("Mon|20:00");
    expect(keys).toContain("Mon|20:45");
    expect(keys).toContain("Tue|07:00");
    expect(keys).toContain("Tue|07:45");
    expect(keys.every((k) => k.startsWith("Mon|") || k.startsWith("Tue|"))).toBe(true);
  });
});

describe("formatEventWhen", () => {
  it("labels events for the import review list", () => {
    const [soccer] = parseIcs(SAMPLE_ICS).filter((e) => e.uid === "evt-tzid-2");
    expect(formatEventWhen(soccer)).toContain("weekly");
    const [noSchool] = parseIcs(SAMPLE_ICS).filter((e) => e.uid === "evt-allday-3");
    expect(formatEventWhen(noSchool)).toContain("all day");
  });
});
