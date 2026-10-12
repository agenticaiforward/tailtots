/**
 * Kids events data for the Plan tab.
 *
 * Curated from the daily kids-events digest research (zip-code based, DFW area
 * + online). Free events prioritized; paid events marked "worthy" when the
 * value justifies the cost for 1 adult + 2 kids.
 *
 * The daily digest cron refreshes this file with new verified events.
 */

export type KidsEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** Human-readable time, e.g. "11 AM – 5 PM" */
  time: string;
  venue: string;
  address: string;
  /** "free" | "$X" | "$X/car" etc. */
  cost: string;
  isFree: boolean;
  /** True when a paid event is worth it (high kid value, under ~$50 for 1+2). */
  worthy?: boolean;
  /** online | dfw (zip-code area) */
  scope: "online" | "dfw";
  /** Categories for "looking for" matching: stem, art, animals, music, sports, reading, holiday, etc. */
  tags: string[];
  url?: string;
  ages?: string;
};

export const KIDS_EVENTS: KidsEvent[] = [
  {
    id: "state-fair-2026",
    title: "State Fair of Texas",
    date: "2026-10-13",
    time: "10 AM – 9 PM",
    venue: "Fair Park Dallas",
    address: "Fair Park, Dallas TX",
    cost: "$10 after 5 PM",
    isFree: false,
    worthy: true,
    scope: "dfw",
    tags: ["holiday", "food", "animals", "music"],
    url: "https://bigtex.com",
    ages: "All ages",
  },
  {
    id: "plano-intl-fest",
    title: "Plano International Festival",
    date: "2026-10-17",
    time: "11 AM – 5 PM",
    venue: "Haggard Park",
    address: "901 E 15th St, Plano TX",
    cost: "Free",
    isFree: true,
    scope: "dfw",
    tags: ["music", "art", "stem", "food", "holiday"],
    url: "https://planointernationalfestival.org",
    ages: "All ages",
  },
  {
    id: "dfw-fall-fest",
    title: "DFW Fall Fest",
    date: "2026-10-17",
    time: "10 AM – 2 PM",
    venue: "Frisco Fresh Market",
    address: "9215 John W. Elliott Dr, Frisco TX",
    cost: "Free",
    isFree: true,
    scope: "dfw",
    tags: ["holiday", "animals", "art", "food"],
    ages: "All ages",
  },
  {
    id: "falloween-sachse",
    title: "Fall-O-Ween Sachse",
    date: "2026-10-17",
    time: "4 – 8 PM",
    venue: "Sachse",
    address: "Sachse TX",
    cost: "Free",
    isFree: true,
    scope: "dfw",
    tags: ["holiday", "art"],
    ages: "All ages",
  },
  {
    id: "nasa-stem-downlink",
    title: "NASA STEM Downlink — Live from the ISS",
    date: "2026-10-16",
    time: "11:30 – 11:50 AM CT",
    venue: "Online",
    address: "YouTube",
    cost: "Free",
    isFree: true,
    scope: "online",
    tags: ["stem", "space"],
    url: "https://www.youtube.com/nasa",
    ages: "All ages",
  },
  {
    id: "kaleidoscope-after5",
    title: "Kaleidoscope Live After 5",
    date: "2026-10-15",
    time: "5:30 – 7:30 PM",
    venue: "Kaleidoscope Park",
    address: "Frisco TX",
    cost: "Free",
    isFree: true,
    scope: "dfw",
    tags: ["music", "art"],
    ages: "All ages",
  },
  {
    id: "saturyay",
    title: "SaturYAY at Kaleidoscope",
    date: "2026-10-17",
    time: "10 AM – 12 PM",
    venue: "Kaleidoscope Park",
    address: "Frisco TX",
    cost: "Free",
    isFree: true,
    scope: "dfw",
    tags: ["art", "music", "stem"],
    ages: "All ages",
  },
  {
    id: "folded-bracelets",
    title: "Folded Paper Bracelets",
    date: "2026-10-15",
    time: "7 – 8 PM",
    venue: "Frisco Public Library",
    address: "8000 Dallas Pkwy, Frisco TX",
    cost: "Free",
    isFree: true,
    scope: "dfw",
    tags: ["art", "reading"],
    ages: "Grades 4–8",
  },
  {
    id: "read-to-rover",
    title: "Read to Rover",
    date: "2026-10-17",
    time: "Morning",
    venue: "Denton Library",
    address: "Denton TX",
    cost: "Free",
    isFree: true,
    scope: "dfw",
    tags: ["reading", "animals"],
    ages: "Kids",
  },
  {
    id: "heard-museum",
    title: "Heard Museum — Dinosaurs Live!",
    date: "2026-10-18",
    time: "All day",
    venue: "Heard Natural Science Museum",
    address: "McKinney TX",
    cost: "$40 trio",
    isFree: false,
    worthy: true,
    scope: "dfw",
    tags: ["stem", "animals"],
    ages: "All ages",
  },
  {
    id: "pumpkinfest-grapevine",
    title: "PumpkinFest Grapevine",
    date: "2026-10-18",
    time: "10 AM – 9 PM",
    venue: "Grapevine",
    address: "Grapevine TX",
    cost: "$20/car",
    isFree: false,
    worthy: true,
    scope: "dfw",
    tags: ["holiday", "food"],
    ages: "All ages",
  },
  {
    id: "spooky-spanish",
    title: "Spooky Spanish (Outschool)",
    date: "2026-10-13",
    time: "Various slots",
    venue: "Online",
    address: "Outschool",
    cost: "$10",
    isFree: false,
    scope: "online",
    tags: ["reading", "holiday"],
    ages: "Kids",
  },
  {
    id: "roblox-coding",
    title: "Coding in Roblox (Outschool)",
    date: "2026-10-16",
    time: "Various slots",
    venue: "Online",
    address: "Outschool",
    cost: "$18",
    isFree: false,
    scope: "online",
    tags: ["stem"],
    ages: "Kids",
  },
];

/** Get events for a date range, sorted: free first, then worthy paid, then other paid. */
export function eventsForRange(start: string, end: string): KidsEvent[] {
  return KIDS_EVENTS
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => {
      // Free first
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      // Worthy paid next
      if (a.worthy && !b.worthy) return -1;
      if (!a.worthy && b.worthy) return 1;
      // Then by date
      return a.date.localeCompare(b.date);
    });
}

/** Check if an event matches any of the parent's "looking for" interests. */
export function matchesInterests(event: KidsEvent, interests: string[]): boolean {
  const lower = interests.map((i) => i.toLowerCase());
  return event.tags.some((tag) => lower.some((i) => i.includes(tag) || tag.includes(i))) ||
    lower.some((i) => event.title.toLowerCase().includes(i));
}
