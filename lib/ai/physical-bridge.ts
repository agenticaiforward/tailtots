/**
 * Mission-to-Physical Bridge — billion-dollar redesign, Change 4.
 *
 * Digital-to-physical loops create parent-visible value, which defends the
 * subscription at renewal. When a child completes a digital mission, this
 * module suggests a real-world extension: "You earned the Gardener badge —
 * here's a seed-planting activity for this weekend."
 *
 * Two layers:
 *  - suggestPhysicalExtension: deterministic mapping from mission category
 *    (+ season + age band) to a concrete activity. Pure function.
 *  - buildPhysicalExtensionPrompt: prompt builder for the LLM to invent
 *    creative, personalized extensions. Model sees category + season + age
 *    band only — never PII.
 *
 * Zero LLM calls in this module. Prompt builders only.
 */

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export interface PhysicalExtensionInput {
  /** Mission category, e.g. "pet_care", "kindness", "chore". */
  category: string;
  /** What the mission was about, in a few words. No PII. */
  missionTheme: string;
  season: Season;
  /** Coarse age band: "4-6" | "7-9" | "10-12". */
  ageBand: string;
}

export interface PhysicalExtension {
  title: string;
  description: string;
  /** Rough minutes. */
  minutes: number;
  /** What the parent needs on hand (keep it household-simple). */
  materials: string[];
}

/** Deterministic activity templates per category. */
const CATEGORY_TEMPLATES: Record<string, Omit<PhysicalExtension, "title">[]> = {
  pet_care: [
    {
      description: "Teach your pet one new trick using three tiny treats. Practice for 5 minutes, then show the family.",
      minutes: 15,
      materials: ["treats", "a quiet corner"],
    },
    {
      description: "Make a 'pet report card' — draw your pet and write down three things they did well this week.",
      minutes: 20,
      materials: ["paper", "crayons"],
    },
  ],
  kindness: [
    {
      description: "Make a thank-you card for someone who helps your family — a neighbor, teacher, or grandparent.",
      minutes: 20,
      materials: ["paper", "crayons or markers"],
    },
    {
      description: "Pick one toy in good shape to give to a shelter or donation box together.",
      minutes: 30,
      materials: ["a donation bag"],
    },
  ],
  chore: [
    {
      description: "Reorganize one drawer or shelf your way — then teach a family member your system.",
      minutes: 25,
      materials: ["one drawer or shelf"],
    },
  ],
  money: [
    {
      description: "Sort coins by type and count how much is in the jar. Decide together: save, spend, or give?",
      minutes: 20,
      materials: ["coin jar", "paper for sorting"],
    },
  ],
  community: [
    {
      description: "Pick up litter on your street or at a park — see how much you can collect in 15 minutes.",
      minutes: 20,
      materials: ["a bag", "gloves"],
    },
  ],
};

const SEASONAL_TWISTS: Record<Season, string> = {
  spring: "Spring twist: do it outside and notice what's blooming.",
  summer: "Summer twist: bring water and take a shade break halfway.",
  fall: "Fall twist: collect one colorful leaf while you're at it.",
  winter: "Winter twist: do the cozy indoor version with hot cocoa after.",
};

/** Deterministic suggestion. Pure function — same input, same output. */
export function suggestPhysicalExtension(
  input: PhysicalExtensionInput,
): PhysicalExtension | null {
  const templates = CATEGORY_TEMPLATES[input.category];
  if (!templates || templates.length === 0) return null;
  // Stable pick: hash the theme so the same mission always maps to the
  // same activity (no confusing swaps week to week).
  let hash = 0;
  for (const ch of input.missionTheme) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const t = templates[hash % templates.length];
  const twist = SEASONAL_TWISTS[input.season];
  return {
    title: `Weekend project: ${input.category.replace(/_/g, " ")}`,
    description: `${t.description} ${twist}`,
    minutes: t.minutes,
    materials: t.materials,
  };
}

export const PHYSICAL_EXTENSION_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

/**
 * Prompt builder for creative, personalized physical extensions.
 * Model sees category + theme + season + age band — coarse only, never PII.
 */
export function buildPhysicalExtensionPrompt(input: PhysicalExtensionInput): string {
  return [
    `Suggest a real-world weekend activity for a child (age band ${input.ageBand}) that extends a "${input.category}" mission about "${input.missionTheme}".`,
    `It is ${input.season}. The activity should use only common household materials, take 15-30 minutes, and involve the parent doing it together with the child.`,
    "Rules: one activity only. 2-3 sentences, max 200 characters. Concrete and doable — no shopping required. No exclamation marks. Never mention AI, data, or tracking.",
  ].join("\n");
}

/** Validate an LLM-generated extension. Null when unusable (caller uses the deterministic suggestion). */
export function parsePhysicalExtensionResponse(text: string): string | null {
  if (typeof text !== "string") return null;
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length < 20 || cleaned.length > 400) return null;
  return cleaned;
}
