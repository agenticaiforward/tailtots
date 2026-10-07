/**
 * Parent availability calendar — 15-minute week grid + calendar import.
 *
 * Feedback round 2, schedule stream. Pure helpers (unit-tested in
 * lib/__tests__/schedule-calendar.test.ts); the UI lives in
 * app/components/TailTotsApp.tsx inside the SchedulePanel region.
 *
 * Data model
 * ----------
 * Availability is stored as an array of *canonical slot keys* per kid:
 *   "Mon|16:00"  →  Monday, 4:00 PM (a 15-minute slot starting then)
 * Day abbreviations are Mon..Sun; the time is 24-hour HH:MM.
 *
 * Older builds stored human labels ("Tuesday 4:30–6:00 PM"). Those keep
 * working: `isCanonicalSlotKey` tells them apart, and `expandSlotLabel`
 * turns both the new merged range labels and the legacy labels back into
 * canonical keys so claimed slots stay disabled in the grid.
 */

/* ------------------------------------------------------------------ */
/* OAuth / connect-button gaps (feedback R2 item 19)                   */
/*                                                                     */
/* SCHEDULE_GOOGLE_OAUTH_CONFIGURED / SCHEDULE_APPLE_CALENDAR_CONFIGURED */
/* are false: this repo has NO OAuth credentials for either provider, */
/* so the connect buttons in the UI render a "needs setup" state.      */
/*                                                                     */
/* Exactly what is needed to make them work:                           */
/*                                                                     */
/* Google Calendar                                                     */
/*  1. A Google Cloud project with the Calendar API enabled.           */
/*  2. An OAuth 2.0 Client ID (Web application) with an authorized     */
/*     redirect URI pointing at the app (e.g. the /api/auth/google    */
/*     callback route).                                                */
/*  3. The `https://www.googleapis.com/auth/calendar.readonly` scope.  */
/*  4. A server-side token exchange (Cloudflare Worker secret holding */
/*     the client secret — never in client code), then                 */
/*     GET https://www.googleapis.com/calendar/v3/calendars/primary/   */
/*     events → map each event to busy slots with `eventToBusySlots`.  */
/*                                                                     */
/* Apple / iPhone Calendar                                             */
/*  Apple offers no web OAuth for iCloud Calendar. The realistic paths */
/*  are: (a) in the native iOS app, read the device calendar with      */
/*  EventKit (`NSCalendarsUsageDescription` entitlement, user grants    */
/*  access, then map EKEvents to busy slots); or (b) have the parent   */
/*  export an .ics from iCloud.com (Calendar → Settings → Advanced →  */
/*  export) and use the working .ics import below.                     */
/*                                                                     */
/* Until either is wired, the .ics file import is the fully working    */
/* path — it needs no credentials.                                     */
/* ------------------------------------------------------------------ */
export const SCHEDULE_GOOGLE_OAUTH_CONFIGURED = false;
export const SCHEDULE_APPLE_CALENDAR_CONFIGURED = false;

export const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

/** JS getDay() (0=Sun..6=Sat) → schedule day abbreviation. */
const JS_DAY_TO_ABBREV: ScheduleDay[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Grid hour rows: 7 AM … 8 PM (last bookable slot starts 8:45 PM). */
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 20;
export const SLOT_MINUTES = 15;

const DAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

/** Canonical 15-minute slot key, e.g. "Mon|16:00". */
export function slotKey(day: ScheduleDay, hour: number, minute: number): string {
  return `${day}|${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isCanonicalSlotKey(value: string): boolean {
  return /^[A-Z][a-z]{2}\|\d{2}:\d{2}$/.test(value) && value.slice(0, 3) in DAY_INDEX;
}

export interface ParsedSlotKey {
  day: ScheduleDay;
  hour: number;
  minute: number;
}

export function parseSlotKey(key: string): ParsedSlotKey | null {
  const match = /^([A-Z][a-z]{2})\|(\d{2}):(\d{2})$/.exec(key);
  if (!match) return null;
  const day = match[1] as ScheduleDay;
  if (!(day in DAY_INDEX) || (DAY_INDEX[day] ?? 0) > 6) return null;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59 || minute % SLOT_MINUTES !== 0) return null;
  return { day, hour, minute };
}

/** "4:00 PM" for (16, 0). */
export function formatTime12(hour: number, minute: number): string {
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

/** "4 PM" hour-row label. */
export function formatHourLabel(hour: number): string {
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${ampm}`;
}

/** "Mon 4:00–5:00 PM" — the shared AM/PM is elided; kept on both sides when they differ. */
function formatRangeLabel(day: ScheduleDay, sh: number, sm: number, eh: number, em: number): string {
  const start = formatTime12(sh, sm);
  const end = formatTime12(eh, em);
  const startAmpm = sh < 12 ? "AM" : "PM";
  const endAmpm = eh < 12 || eh === 24 ? "AM" : "PM";
  if (startAmpm === endAmpm) {
    return `${day} ${start.slice(0, -3)}–${end}`;
  }
  return `${day} ${start}–${end}`;
}
export function slotKeyLabel(key: string): string {
  const parsed = parseSlotKey(key);
  if (!parsed) return key;
  return `${parsed.day} ${formatTime12(parsed.hour, parsed.minute)}`;
}

/** Weekday abbreviation for a Date, in the device's local timezone. */
export function dayAbbrevForDate(date: Date): ScheduleDay {
  return JS_DAY_TO_ABBREV[date.getDay()];
}

/**
 * Merge canonical keys into readable range labels, grouped by day:
 * ["Mon|16:00","Mon|16:15","Tue|9:00"] → ["Mon 4:00–4:30 PM","Tue 9:00 AM"].
 * Invalid keys are ignored. Used for the invite slot list and the grid summary.
 */
export function mergeSlotKeys(keys: string[]): string[] {
  const byDay = new Map<ScheduleDay, Array<{ hour: number; minute: number }>>();
  for (const key of keys) {
    const parsed = parseSlotKey(key);
    if (!parsed) continue;
    const list = byDay.get(parsed.day) ?? [];
    list.push({ hour: parsed.hour, minute: parsed.minute });
    byDay.set(parsed.day, list);
  }
  const labels: string[] = [];
  for (const day of SCHEDULE_DAYS) {
    const slots = byDay.get(day);
    if (!slots || slots.length === 0) continue;
    const minutes = [...new Set(slots.map((s) => s.hour * 60 + s.minute))].sort((a, b) => a - b);
    let rangeStart = minutes[0];
    let prev = minutes[0];
    const flush = (start: number, end: number) => {
      const sh = Math.floor(start / 60);
      const sm = start % 60;
      if (end - start === SLOT_MINUTES) {
        labels.push(`${day} ${formatTime12(sh, sm)}`);
      } else {
        labels.push(formatRangeLabel(day, sh, sm, Math.floor(end / 60), end % 60));
      }
    };
    for (let i = 1; i < minutes.length; i++) {
      if (minutes[i] === prev + SLOT_MINUTES) {
        prev = minutes[i];
      } else {
        flush(rangeStart, prev + SLOT_MINUTES);
        rangeStart = minutes[i];
        prev = minutes[i];
      }
    }
    flush(rangeStart, prev + SLOT_MINUTES);
  }
  return labels;
}

function to24(hour12: number, ampm: string): number {
  const upper = ampm.toUpperCase();
  if (upper === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

const DAY_ALTERNATION = "Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday";

function expandRange(day: string, sh: number, sm: number, eh: number, em: number): string[] {
  const abbrev = day.slice(0, 3) as ScheduleDay;
  if (!(abbrev in DAY_INDEX)) return [];
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (end <= start || end - start > 24 * 60) return [];
  const keys: string[] = [];
  for (let m = start; m < end; m += SLOT_MINUTES) {
    keys.push(slotKey(abbrev, Math.floor(m / 60), m % 60));
  }
  return keys;
}

/**
 * Expand a slot label back into canonical keys. Handles:
 * - canonical keys themselves ("Mon|16:00"),
 * - merged range labels ("Mon 4:00–5:00 PM", "Sat 10:00 AM–12:00 PM",
 *   "Tue 9:00 AM"),
 * - legacy labels from earlier builds ("Tuesday 4:30–6:00 PM",
 *   "Saturday 10:00 AM–12:00 PM").
 * Anything unparseable (e.g. "Sunday afternoon") is returned as-is so
 * callers can still match it literally.
 */
export function expandSlotLabel(label: string): string[] {
  const trimmed = label.trim();
  if (isCanonicalSlotKey(trimmed)) return [trimmed];
  // Range with an optional AM/PM on the start ("Mon 4:00–5:00 PM" shares the
  // suffix; "Sat 10:00 AM–12:00 PM" repeats it). An absent start marker
  // inherits the end marker.
  const range = new RegExp(
    `^(${DAY_ALTERNATION})\\s+(\\d{1,2})(?::(\\d{2}))?\\s*([AP]M)?\\s*[\\u2013\\u2014-]\\s*(\\d{1,2})(?::(\\d{2}))?\\s*([AP]M)$`,
    "i",
  ).exec(trimmed);
  if (range) {
    const startAmpm = range[4] ?? range[7];
    const keys = expandRange(
      range[1],
      to24(Number(range[2]), startAmpm),
      Number(range[3] ?? "0"),
      to24(Number(range[5]), range[7]),
      Number(range[6] ?? "0"),
    );
    if (keys.length > 0) return keys;
  }
  const single = new RegExp(`^(${DAY_ALTERNATION})\\s+(\\d{1,2})(?::(\\d{2}))?\\s*([AP]M)$`, "i").exec(trimmed);
  if (single) {
    const abbrev = single[1].slice(0, 3) as ScheduleDay;
    if (abbrev in DAY_INDEX) {
      return [slotKey(abbrev, to24(Number(single[2]), single[4]), Number(single[3] ?? "0"))];
    }
  }
  return [trimmed];
}

/* ------------------------------------------------------------------ */
/* ICS parsing (fully working — no credentials needed)                 */
/* ------------------------------------------------------------------ */

export interface ParsedCalendarEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  recurringWeekly: boolean;
  /** Local weekday of the event start. */
  weekday: ScheduleDay;
}

interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseIcsProperty(line: string): IcsProperty | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [rawName, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: rawName.toUpperCase(), params, value };
}

interface DateParts {
  y: number; mo: number; d: number; h: number; mi: number; s: number;
}

/** Convert a wall-clock time in `tzid` to a Date (UTC instant), best effort. */
function zonedTimeToDate(tzid: string, parts: DateParts): Date | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const target = Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, parts.s);
    let guess = target;
    for (let i = 0; i < 3; i++) {
      const parsed = new Map(dtf.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
      let hh = Number(parsed.get("hour") ?? "0");
      if (hh === 24) hh = 0; // midnight edge in hour12:false mode
      const asUtc = Date.UTC(
        Number(parsed.get("year") ?? "0"),
        Number(parsed.get("month") ?? "1") - 1,
        Number(parsed.get("day") ?? "0"),
        hh,
        Number(parsed.get("minute") ?? "0"),
        Number(parsed.get("second") ?? "0"),
      );
      const diff = target - asUtc;
      if (diff === 0) break;
      guess += diff;
    }
    return new Date(guess);
  } catch {
    return null;
  }
}

function parseIcsDateTime(prop: IcsProperty): { date: Date; allDay: boolean } | null {
  const { params, value } = prop;
  if (params["VALUE"] === "DATE" || /^\d{8}$/.test(value)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (!m) return null;
    return { date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return null;
  const parts: DateParts = {
    y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]),
    h: Number(m[4]), mi: Number(m[5]), s: Number(m[6]),
  };
  if (m[7] === "Z") return { date: new Date(Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, parts.s)), allDay: false };
  const tzid = params["TZID"];
  if (tzid) {
    const converted = zonedTimeToDate(tzid, parts);
    if (converted) return { date: converted, allDay: false };
    // Unknown TZID — fall through to floating local time rather than dropping the event.
  }
  return { date: new Date(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, parts.s), allDay: false };
}

function parseIcsDuration(value: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(value.trim());
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  const days = Number(m[1] ?? "0");
  const hours = Number(m[2] ?? "0");
  const minutes = Number(m[3] ?? "0");
  const seconds = Number(m[4] ?? "0");
  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
}

/**
 * Parse an .ics / iCalendar file into events. Handles UTC (`Z`), floating
 * local times, TZID values (best effort via Intl), all-day DATE values,
 * DURATION (when DTEND is absent), and flags weekly RRULE recurrences.
 * Malformed events are skipped, never thrown.
 */
export function parseIcs(text: string): ParsedCalendarEvent[] {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r\n|\n/);
  const events: ParsedCalendarEvent[] = [];
  let current: IcsProperty[] | null = null;
  const flush = () => {
    if (current) {
      const event = buildEvent(current);
      if (event) events.push(event);
    }
    current = null;
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      flush();
      current = [];
    } else if (line === "END:VEVENT") {
      flush();
    } else if (current && line && !line.startsWith("BEGIN:") && !line.startsWith("END:")) {
      const prop = parseIcsProperty(line);
      if (prop) current.push(prop);
    } else if (line === "END:VCALENDAR") {
      flush();
    }
  }
  flush();
  return events;
}

function buildEvent(props: IcsProperty[]): ParsedCalendarEvent | null {
  const get = (name: string) => props.find((p) => p.name === name);
  const startProp = get("DTSTART");
  if (!startProp) return null;
  const startParsed = parseIcsDateTime(startProp);
  if (!startParsed) return null;
  let end: Date;
  let allDay = startParsed.allDay;
  const endProp = get("DTEND");
  if (endProp) {
    const endParsed = parseIcsDateTime(endProp);
    if (!endParsed) return null;
    end = endParsed.date;
    allDay = allDay && endParsed.allDay;
  } else {
    const durationProp = get("DURATION");
    const durationMs = durationProp ? parseIcsDuration(durationProp.value) : null;
    if (durationMs != null) {
      end = new Date(startParsed.date.getTime() + durationMs);
    } else if (allDay) {
      end = new Date(startParsed.date.getTime() + 24 * 60 * 60 * 1000);
    } else {
      return null; // no end and no duration — can't map to slots
    }
  }
  if (!(end.getTime() > startParsed.date.getTime())) return null;
  const rrule = get("RRULE");
  const recurringWeekly = !!rrule && /FREQ=WEEKLY/i.test(rrule.value);
  return {
    uid: get("UID")?.value ?? "",
    summary: (get("SUMMARY")?.value ?? "(no title)").replace(/\\(.)/g, "$1"),
    start: startParsed.date,
    end,
    allDay,
    recurringWeekly,
    weekday: dayAbbrevForDate(startParsed.date),
  };
}

/**
 * Map an event to the canonical busy slot keys it overlaps. The weekly
 * template repeats by weekday, so a one-off Tuesday event blocks the Tuesday
 * column (the import UI says this explicitly). Multi-day events map each
 * 15-minute slice to its own weekday.
 */
export function eventToBusySlotKeys(
  event: ParsedCalendarEvent,
  gridStartHour = GRID_START_HOUR,
  gridEndHour = GRID_END_HOUR,
): string[] {
  const keys = new Set<string>();
  if (event.allDay) {
    for (let h = gridStartHour; h <= gridEndHour; h++) {
      for (let q = 0; q < 60; q += SLOT_MINUTES) keys.add(slotKey(event.weekday, h, q));
    }
    return [...keys];
  }
  // First slot that could overlap: floor the start to 15 minutes.
  const cursor = new Date(event.start);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(Math.floor(cursor.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES);
  let guard = 0;
  while (cursor.getTime() < event.end.getTime() && guard < 5000) {
    guard++;
    const slotStart = cursor.getTime();
    const slotEnd = slotStart + SLOT_MINUTES * 60 * 1000;
    if (slotEnd > event.start.getTime() && slotStart < event.end.getTime()) {
      const h = cursor.getHours();
      if (h >= gridStartHour && h <= gridEndHour) {
        keys.add(slotKey(dayAbbrevForDate(cursor), h, Math.floor(cursor.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES));
      }
    }
    cursor.setTime(cursor.getTime() + SLOT_MINUTES * 60 * 1000);
  }
  return [...keys];
}

/** Short "Oct 12, 4:00 PM" label for import review lists. */
export function formatEventWhen(event: ParsedCalendarEvent): string {
  try {
    const date = event.start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (event.allDay) return `${date} · all day`;
    const time = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date} · ${time(event.start)}–${time(event.end)}${event.recurringWeekly ? " · weekly" : ""}`;
  } catch {
    return event.summary;
  }
}
