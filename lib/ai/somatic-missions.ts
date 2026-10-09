/**
 * Somatic Mission Library — body-first missions for the AI-native Mission Engine.
 *
 * Three mission types, all built on one rule: the body moves first, thinking
 * comes later. These are "body missions" in kid language — never framed as
 * treatment, therapy, or anything clinical. No fail state, no cognitive load,
 * no scorekeeping. Completion = participation. Always optional.
 *
 * Design principles (trauma-informed, never clinical):
 * - DISCHARGE: big, silly, whole-body movement that lets wiggles out
 * - RHYTHMIC: slow, repetitive, predictable movement that settles the body
 * - HEAVY_WORK: pushing, pulling, carrying — deep pressure through the muscles
 *
 * Voice: Sadhguru-inspired companionship — the parent does it WITH the child,
 * side by side, never supervising. Joy and silliness are the point.
 *
 * All content is original, written for this library. No trademarked program
 * names, no clinical language, no copied text from any source.
 */

import type { IdeaAgeBand } from "./ideas";
import type {
  GeneratedMission,
  MissionDifficulty,
  ThriverTrait,
} from "./mission-engine";

/** The three body-mission types. */
export const SOMATIC_TYPES = ["discharge", "rhythmic", "heavy_work"] as const;
export type SomaticType = (typeof SOMATIC_TYPES)[number];

/** Kid-friendly label for each type (used in UI, never clinical). */
export const SOMATIC_TYPE_LABELS: Record<SomaticType, string> = {
  discharge: "Wiggle It Out",
  rhythmic: "Slow & Steady",
  heavy_work: "Strong Work",
};

/** One body mission in the catalog. */
export interface SomaticMission {
  /** Stable id for logging and tests. */
  id: string;
  title: string;
  /** Parent-facing instructions. Always "do it together" framing. */
  detail: string;
  minutes: number;
  type: SomaticType;
  /** Which age bands this mission fits. */
  ageBands: IdeaAgeBand[];
  /** Primary developmental trait exercised (from the master taxonomy). */
  traitFocus: ThriverTrait;
  /** True when the mission involves the family's pet. */
  petLinked: boolean;
  /** True when the mission needs a pet to work. Skipped when no pets. */
  requiresPet: boolean;
}

// ---------------------------------------------------------------------------
// The catalog: 27 original body missions, 9 per type, age-banded.
// ---------------------------------------------------------------------------

export const SOMATIC_MISSIONS: SomaticMission[] = [
  // ==================== DISCHARGE: wiggle it out ====================
  {
    id: "shake-it-off-dance",
    title: "Shake-It-Off Dance",
    detail:
      "Put on your child's favorite song and shake EVERYTHING together — arms, legs, head, whole body — for the whole song. Sillier is better. When the song ends, freeze and giggle.",
    minutes: 4,
    type: "discharge",
    ageBands: ["4-6", "7-9", "10-12"],
    traitFocus: "optimism",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "stomp-parade",
    title: "Dinosaur Stomp Parade",
    detail:
      "March around the house or yard stomping like dinosaurs together — big heavy steps, arms swinging, roaring if you want. Lead the parade, then let your child lead it back.",
    minutes: 5,
    type: "discharge",
    ageBands: ["4-6", "7-9"],
    traitFocus: "confidence",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "wiggle-freeze",
    title: "Wiggle Freeze",
    detail:
      "Wiggle as wildly as you both can — then you shout FREEZE and hold perfectly still. Unfreeze, wiggle again. Take turns being the freezer. The giggles are the whole point.",
    minutes: 4,
    type: "discharge",
    ageBands: ["4-6"],
    traitFocus: "self-control",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "pillow-punch-party",
    title: "Pillow Punch Party",
    detail:
      "Grab every pillow in the house. Punch them, throw them, stack them, knock the stack down — together. Set a 3-minute timer and see how wild it gets. Then rebuild the couch as a team.",
    minutes: 6,
    type: "discharge",
    ageBands: ["7-9", "10-12"],
    traitFocus: "optimism",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "silly-sprint",
    title: "Silly Sprint",
    detail:
      "Race to the fence (or the end of the hall) and back, three times — but the silliest run wins, not the fastest. Flap arms, wobble knees, make faces. You run too.",
    minutes: 5,
    type: "discharge",
    ageBands: ["7-9", "10-12"],
    traitFocus: "confidence",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "jump-and-shout",
    title: "Jump and Shout",
    detail:
      "Jump 10 times together, shouting a silly word on every jump — pick the word together first (\"PICKLE!\" works great). Count out loud. Collapse laughing at the end.",
    minutes: 3,
    type: "discharge",
    ageBands: ["4-6", "7-9"],
    traitFocus: "optimism",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "animal-stampede",
    title: "Animal Stampede",
    detail:
      "Cross the yard or living room as a stampede: stomp like elephants for 10 steps, hop like bunnies for 10, waddle like penguins for 10. Do every animal together, side by side.",
    minutes: 5,
    type: "discharge",
    ageBands: ["4-6", "7-9"],
    traitFocus: "curiosity",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "balloon-bop",
    title: "Balloon Bop",
    detail:
      "Blow up a balloon and keep it in the air together — no holding, only bopping. Count your streak out loud. When it drops, celebrate the number and start again.",
    minutes: 5,
    type: "discharge",
    ageBands: ["7-9", "10-12"],
    traitFocus: "perseverance",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "thunder-clap",
    title: "Thunder Clap Rhythm",
    detail:
      "Sit facing each other. You start a clap-stomp pattern; your child echoes it. Speed up together until it falls apart laughing. Then switch — they lead, you echo.",
    minutes: 4,
    type: "discharge",
    ageBands: ["10-12", "7-9"],
    traitFocus: "confidence",
    petLinked: false,
    requiresPet: false,
  },

  // ==================== RHYTHMIC: slow & steady ====================
  {
    id: "slow-brush-club",
    title: "Slow Brush Club",
    detail:
      "Sit together with your pet. Take turns doing 5 very slow brush strokes each — count them out loud together. Slow wins. If the pet walks away, that's fine; you two keep the rhythm going.",
    minutes: 5,
    type: "rhythmic",
    ageBands: ["4-6", "7-9", "10-12"],
    traitFocus: "empathy",
    petLinked: true,
    requiresPet: true,
  },
  {
    id: "breathe-with-buddy",
    title: "Breathe With Buddy",
    detail:
      "Sit with your pet (or a stuffed animal) and rest a hand gently on their side. Breathe in and out together, watching their sides move. See if you can match their slow rhythm for one minute.",
    minutes: 3,
    type: "rhythmic",
    ageBands: ["4-6", "7-9", "10-12"],
    traitFocus: "self-control",
    petLinked: true,
    requiresPet: false,
  },
  {
    id: "rocking-chair-story",
    title: "Rocking Chair Story",
    detail:
      "Sit together in a rocking chair or on the floor leaning back-to-back. Rock gently while you read one page (or tell one tiny story). Match your rocking to your breathing.",
    minutes: 5,
    type: "rhythmic",
    ageBands: ["4-6"],
    traitFocus: "empathy",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "humming-walk",
    title: "Humming Walk",
    detail:
      "Walk around the block together humming the same tune — pick it together before you leave. Try to match each other's steps to the hum. No talking needed, just humming and walking.",
    minutes: 10,
    type: "rhythmic",
    ageBands: ["7-9", "10-12"],
    traitFocus: "optimism",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "water-pour",
    title: "Slow Water Pour",
    detail:
      "Fill two cups and slowly pour water back and forth between them together. Watch it flow. See how slow you can make it without spilling. Take turns pouring.",
    minutes: 4,
    type: "rhythmic",
    ageBands: ["4-6", "7-9"],
    traitFocus: "self-control",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "petting-countdown",
    title: "Petting Countdown",
    detail:
      "Give your pet 10 slow pets from head to tail, counting down together: 10, 9, 8... Gentle hands, slow pace. If the pet purrs or leans in, you did it perfectly.",
    minutes: 3,
    type: "rhythmic",
    ageBands: ["4-6", "7-9", "10-12"],
    traitFocus: "empathy",
    petLinked: true,
    requiresPet: true,
  },
  {
    id: "swing-sync",
    title: "Swing Sync",
    detail:
      "Find two swings (or take turns on one). Swing side by side and try to match each other's rhythm — same height, same timing. See how long you can stay in sync.",
    minutes: 8,
    type: "rhythmic",
    ageBands: ["7-9", "10-12"],
    traitFocus: "perseverance",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "dough-knead",
    title: "Dough Knead Together",
    detail:
      "Knead dough or clay side by side — push, fold, push, fold. Match each other's rhythm. Make something together or just enjoy the squish. Warm hands, slow pace.",
    minutes: 10,
    type: "rhythmic",
    ageBands: ["7-9", "10-12"],
    traitFocus: "perseverance",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "heartbeat-hands",
    title: "Back-to-Back Breathing",
    detail:
      "Sit back to back on the floor. Close your eyes and feel each other's breathing. See if your breathing slows down together. Stay as long as it feels good — even one minute counts.",
    minutes: 3,
    type: "rhythmic",
    ageBands: ["10-12", "7-9"],
    traitFocus: "empathy",
    petLinked: false,
    requiresPet: false,
  },

  // ==================== HEAVY_WORK: strong work ====================
  {
    id: "grocery-haul",
    title: "Grocery Haul Team",
    detail:
      "Carry the grocery bags in together — everyone takes a bag, even a light one. Walk them in side by side, put everything away as a team. Strong arms, done together.",
    minutes: 8,
    type: "heavy_work",
    ageBands: ["4-6", "7-9", "10-12"],
    traitFocus: "perseverance",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "pet-food-carry",
    title: "Pet Food Carry",
    detail:
      "Carry the pet food bag (or the scoop, for little kids) to the bowl together. Pour it in side by side, then carry the water bowl to refill. Your pet's dinner, delivered by the team.",
    minutes: 4,
    type: "heavy_work",
    ageBands: ["4-6", "7-9", "10-12"],
    traitFocus: "integrity",
    petLinked: true,
    requiresPet: true,
  },
  {
    id: "push-the-laundry",
    title: "Push the Laundry",
    detail:
      "Load the laundry basket and push it across the room together — race it to the washer. Take turns steering. Heavy pushing counts as the whole mission.",
    minutes: 5,
    type: "heavy_work",
    ageBands: ["4-6", "7-9"],
    traitFocus: "perseverance",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "towel-tug",
    title: "Towel Tug-of-War",
    detail:
      "Grab a big towel, each take an end, and pull — best of 5 rounds. Plant your feet, lean back, pull hard. Shake hands (or hug) after every round, winner or not.",
    minutes: 5,
    type: "heavy_work",
    ageBands: ["7-9", "10-12"],
    traitFocus: "confidence",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "wall-push",
    title: "Wall Push Challenge",
    detail:
      "Stand facing a wall, hands flat on it, and push as hard as you can for a slow count of 10 — together. Rest, then go again. Three rounds. Feel your arms work.",
    minutes: 4,
    type: "heavy_work",
    ageBands: ["10-12", "7-9"],
    traitFocus: "perseverance",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "cushion-fort-build",
    title: "Cushion Fort Build",
    detail:
      "Carry every couch cushion to one spot and build the biggest fort you can — together. Then crash into it together. Building counts, crashing counts, all of it counts.",
    minutes: 10,
    type: "heavy_work",
    ageBands: ["4-6", "7-9"],
    traitFocus: "confidence",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "watering-can-walk",
    title: "Watering Can Walk",
    detail:
      "Fill two watering cans and carry them to every plant together — inside or outside. Heavy cans, slow walk, water every plant. Refill and go again if you're up for it.",
    minutes: 8,
    type: "heavy_work",
    ageBands: ["7-9", "10-12"],
    traitFocus: "integrity",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "squeeze-play",
    title: "Squeeze Play",
    detail:
      "Grab stress balls, sponges, or rolled-up socks. Squeeze as hard as you can for 5 seconds, then release — 10 times together. Count out loud. Feel the difference when you let go.",
    minutes: 3,
    type: "heavy_work",
    ageBands: ["4-6", "7-9"],
    traitFocus: "self-control",
    petLinked: false,
    requiresPet: false,
  },
  {
    id: "backpack-march",
    title: "Backpack March",
    detail:
      "Load two backpacks with books, put them on, and march around the house together — up stairs, around rooms, a full loop. Heavy backs, strong legs, done as a team.",
    minutes: 6,
    type: "heavy_work",
    ageBands: ["10-12", "7-9"],
    traitFocus: "perseverance",
    petLinked: false,
    requiresPet: false,
  },
];

// ---------------------------------------------------------------------------
// Deterministic selection
// ---------------------------------------------------------------------------

export interface PickSomaticOptions {
  ageBand: IdeaAgeBand;
  /** True when the family has at least one pet. */
  hasPets: boolean;
  /** Preferred type; when omitted, rotates across all three. */
  preferType?: SomaticType;
  /** 0-based seed for deterministic rotation (e.g. day index). */
  seed?: number;
}

/**
 * Deterministically pick a somatic mission for the given context.
 * Pure function — same inputs, same mission. Filters by age band and pet
 * availability, then rotates through the pool by seed so repeated calls
 * vary the mission instead of repeating one.
 */
export function pickSomaticMission(options: PickSomaticOptions): SomaticMission {
  const { ageBand, hasPets, preferType, seed = 0 } = options;
  const pool = SOMATIC_MISSIONS.filter(
    (m) =>
      m.ageBands.includes(ageBand) &&
      (!m.requiresPet || hasPets) &&
      (!preferType || m.type === preferType),
  );
  // Fallbacks: relax the type preference, then the pet requirement, so this
  // function never throws on thin pools.
  const relaxed =
    pool.length > 0
      ? pool
      : SOMATIC_MISSIONS.filter(
          (m) => m.ageBands.includes(ageBand) && (!m.requiresPet || hasPets),
        );
  const finalPool =
    relaxed.length > 0
      ? relaxed
      : SOMATIC_MISSIONS.filter((m) => !m.requiresPet);
  return finalPool[seed % finalPool.length];
}

/**
 * Convert a somatic mission into a GeneratedMission for the mission set.
 * Difficulty is always "easy" — body missions have no fail state and no
 * cognitive load, so difficulty calibration never applies to them.
 */
export function somaticToGeneratedMission(
  mission: SomaticMission,
  traitFocus: ThriverTrait | null = mission.traitFocus,
): GeneratedMission {
  return {
    title: mission.title,
    detail: mission.detail,
    skill: "empathy",
    category: mission.petLinked ? "pet_care" : "chore",
    difficulty: "easy" as MissionDifficulty,
    points: 8,
    minutes: mission.minutes,
    petLinked: mission.petLinked,
    traitFocus,
  };
}

/** Count missions per type — useful for tests and audits. */
export function somaticTypeCounts(): Record<SomaticType, number> {
  const counts: Record<SomaticType, number> = {
    discharge: 0,
    rhythmic: 0,
    heavy_work: 0,
  };
  for (const m of SOMATIC_MISSIONS) counts[m.type] += 1;
  return counts;
}
