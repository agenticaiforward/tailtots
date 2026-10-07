/**
 * ZIP → neighborhood/apartment picker data (no external API).
 *
 * Manual, curated, and extensible: add entries to NEIGHBORHOOD_DIRECTORY as
 * families ask for their ZIP. Unknown ZIPs fall back to generic place labels
 * plus a free-text "type your own" option in the UI, so the picker never
 * dead-ends.
 */

export const NEIGHBORHOOD_DIRECTORY: Record<string, string[]> = {
  // Frisco, TX
  "75034": ["Stonebriar", "Frisco Square", "The Trails", "Newman Village", "Richwoods"],
  "75035": ["Panther Creek", "Starwood", "Phillips Creek Ranch", "Miranda Estates"],
  // Plano, TX
  "75024": ["Willow Bend", "Legacy", "Deerfield", "Park Forest"],
  "75025": ["Gleneagles", "Hunters Glen", "Kings Ridge"],
  "75093": ["Lakeside on Preston", "Timber Brook", "Avignon"],
  // McKinney, TX
  "75069": ["Stonebridge Ranch", "Eldorado", "Adriatica"],
  "75071": ["Craig Ranch", "Trinity Falls", "Tucker Hill"],
  // Allen, TX
  "75013": ["Twin Creeks", "Waterford Parks", "The Crossing"],
  // Prosper, TX
  "75078": ["Windson", "Whitley Place", "Lakes of Prosper"],
  // Dallas, TX (north)
  "75254": ["Prestonwood", "Far North Dallas"],
  "75252": ["Far North Dallas", "Prestonwood"],
  // Austin, TX
  "78759": ["Arboretum", "Great Hills", "Canyon Creek"],
  // Houston, TX
  "77079": ["Energy Corridor", "Eldridge"],
};

const GENERIC_SUGGESTIONS = [
  "My apartment / rental community",
  "My subdivision",
  "My school zone",
  "Nearby neighborhood",
];

/** Normalize to a 5-digit ZIP, or null when the input isn't a valid US ZIP. */
export function normalizeZip(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  // Accept a leading 5-digit run (so ZIP+4 like "75034-1234" works), but
  // reject 6+ digit runs ("750345") via the word boundary.
  const match = trimmed.match(/^(\d{5})\b/);
  return match ? match[1] : null;
}

/**
 * Neighborhood/apartment suggestions for a ZIP. Known ZIPs return their
 * curated list; unknown-but-valid ZIPs return generic labels so the picker
 * always has options. Invalid input returns [].
 */
export function neighborhoodSuggestionsForZip(rawZip: string): string[] {
  const zip = normalizeZip(rawZip);
  if (!zip) return [];
  const known = NEIGHBORHOOD_DIRECTORY[zip];
  if (known && known.length > 0) return [...known];
  return [...GENERIC_SUGGESTIONS];
}
