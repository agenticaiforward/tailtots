"use client";

/**
 * TtIllustration — the ONE illustration language for TailTots.
 *
 * Soft rounded SVG illustrations in the TailTots palette (pine, sun,
 * cream, navy, grape, tang). Photos are for real families and real pets.
 * Emoji is NEVER a primary design element — use this instead.
 *
 * Usage: <TtIllustration kind="mission" className="size-16" />
 */

export type IllustrationKind =
  | "mission"      // scroll/quest — for mission cards
  | "celebrate"    // star burst — for celebrations, rewards
  | "growth"       // sprout — for trait garden, growth
  | "pet"          // paw — for pet-related (non-photo contexts)
  | "family"       // heart-home — for family/community
  | "wonder"       // magnifier — for curiosity, discovery
  | "shield"       // shield-check — for safety, parent approval
  | "spark"        // lightning-spark — for AI, insights
  | "journey"      // winding path — for journeys, progress
  | "hands"        // helping hands — for kindness, giving
  | "book"         // open book — for learning, school
  | "stethoscope"  // for BCBA/clinical contexts
  | "paw-house"    // shelter — paw in a house outline
  | "calendar"     // for scheduling, playdates
  | "chat"         // for village, community
  | "trophy";      // for milestones, achievements

const PALETTE = {
  pine: "#165a4b",
  pineDeep: "#0d3b30",
  pineTint: "#e7f4ef",
  sun: "#ffd166",
  sunSoft: "#fff4d8",
  gold: "#f4b400",
  cocoa: "#7a4b12",
  navy: "#111b4f",
  grape: "#6d3ed1",
  grapeSoft: "#f0edff",
  tang: "#f47b20",
  tangSoft: "#fde8df",
  cream: "#faf8f0",
  ink: "#17231f",
  white: "#ffffff",
};

function MissionSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="14" y="8" width="36" height="48" rx="10" fill={PALETTE.sunSoft} stroke={PALETTE.gold} strokeWidth="3" />
      <circle cx="32" cy="24" r="7" fill={PALETTE.sun} />
      <path d="M22 40h20M26 47h12" stroke={PALETTE.gold} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="46" cy="14" r="5" fill={PALETTE.pine} />
      <path d="M44 14l1.5 1.5L48.5 12" stroke={PALETTE.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CelebrateSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 6l5.5 13.5L51 22l-10 9.5L44 46 32 38.5 20 46l3-14.5-10-9.5 13.5-2.5Z" fill={PALETTE.sun} stroke={PALETTE.gold} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="12" cy="14" r="3" fill={PALETTE.tang} />
      <circle cx="53" cy="50" r="4" fill={PALETTE.grape} opacity="0.7" />
      <circle cx="55" cy="12" r="2.5" fill={PALETTE.pine} />
      <circle cx="10" cy="48" r="2.5" fill={PALETTE.gold} />
    </svg>
  );
}

function GrowthSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <ellipse cx="32" cy="54" rx="18" ry="6" fill="#d6c9a8" />
      <path d="M32 52C32 40 31 34 28 26" stroke={PALETTE.pineDeep} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="23" cy="38" rx="9" ry="5" fill="#22c55e" transform="rotate(-25 23 38)" />
      <ellipse cx="41" cy="32" rx="9" ry="5" fill="#4ade80" transform="rotate(25 41 32)" />
      <circle cx="30" cy="20" r="6" fill={PALETTE.sun} />
      <circle cx="38" cy="16" r="5" fill={PALETTE.sun} opacity="0.8" />
    </svg>
  );
}

function PetSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <ellipse cx="32" cy="40" rx="14" ry="12" fill={PALETTE.pineTint} stroke={PALETTE.pine} strokeWidth="3" />
      <ellipse cx="20" cy="22" rx="6" ry="8" fill={PALETTE.pineTint} stroke={PALETTE.pine} strokeWidth="3" />
      <ellipse cx="44" cy="22" rx="6" ry="8" fill={PALETTE.pineTint} stroke={PALETTE.pine} strokeWidth="3" />
      <circle cx="26" cy="38" r="3" fill={PALETTE.ink} />
      <circle cx="38" cy="38" r="3" fill={PALETTE.ink} />
      <ellipse cx="32" cy="46" rx="4" ry="3" fill={PALETTE.tang} />
    </svg>
  );
}

function FamilySvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 30 32 12l24 18" stroke={PALETTE.navy} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="16" y="30" width="32" height="22" rx="6" fill={PALETTE.cream} stroke={PALETTE.navy} strokeWidth="3" />
      <path d="M32 44c-6-4-10-7-10-11a6 6 0 0 1 10-4.5A6 6 0 0 1 42 33c0 4-4 7-10 11Z" fill="#e0526e" />
    </svg>
  );
}

function WonderSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="15" fill={PALETTE.grapeSoft} stroke={PALETTE.grape} strokeWidth="4" />
      <line x1="37" y1="37" x2="52" y2="52" stroke={PALETTE.grape} strokeWidth="5" strokeLinecap="round" />
      <path d="M21 24l2.5 2.5M29 21l1 3.5" stroke={PALETTE.grape} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function ShieldSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 6 50 14v16c0 12-8 20-18 28C22 50 14 42 14 30V14Z" fill={PALETTE.pineTint} stroke={PALETTE.pine} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M25 31l6 6 9-11" stroke={PALETTE.pine} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="22" fill={PALETTE.grapeSoft} />
      <path d="M36 12 20 36h11l-2 16 16-24H34Z" fill={PALETTE.grape} strokeLinejoin="round" />
    </svg>
  );
}

function JourneySvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 52C18 52 14 38 26 38c12 0 8-14 20-14 8 0 6 8 10 8" stroke={PALETTE.tang} strokeWidth="4" strokeLinecap="round" strokeDasharray="1 7" />
      <circle cx="8" cy="52" r="5" fill={PALETTE.pine} />
      <path d="M48 22l4 4 8-8" stroke={PALETTE.pine} strokeWidth="0" />
      <circle cx="54" cy="30" r="6" fill={PALETTE.sun} stroke={PALETTE.gold} strokeWidth="2.5" />
      <path d="M51.5 30l1.8 1.8 3.2-3.6" stroke={PALETTE.cocoa} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HandsSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 50c-8-5-14-9-14-15a8 8 0 0 1 14-5.5A8 8 0 0 1 46 35c0 6-6 10-14 15Z" fill="#e0526e" opacity="0.9" />
      <ellipse cx="14" cy="46" rx="8" ry="5" fill={PALETTE.sunSoft} stroke={PALETTE.gold} strokeWidth="2.5" transform="rotate(-20 14 46)" />
      <ellipse cx="50" cy="46" rx="8" ry="5" fill={PALETTE.sunSoft} stroke={PALETTE.gold} strokeWidth="2.5" transform="rotate(20 50 46)" />
    </svg>
  );
}

function BookSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 16c-5-4-12-5-18-4v36c6-1 13 0 18 4 5-4 12-5 18-4V12c-6-1-13 0-18 4Z" fill={PALETTE.white} stroke={PALETTE.navy} strokeWidth="3" strokeLinejoin="round" />
      <line x1="32" y1="16" x2="32" y2="52" stroke={PALETTE.navy} strokeWidth="2.5" />
      <path d="M20 26h8M20 33h8M36 26h8M36 33h8" stroke={PALETTE.grape} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function StethoscopeSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M20 8v18a12 12 0 0 0 24 0V8" stroke={PALETTE.navy} strokeWidth="4" strokeLinecap="round" />
      <circle cx="20" cy="8" r="4" fill={PALETTE.navy} />
      <circle cx="44" cy="8" r="4" fill={PALETTE.navy} />
      <path d="M32 38v8" stroke={PALETTE.navy} strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="52" r="6" fill={PALETTE.white} stroke={PALETTE.navy} strokeWidth="3.5" />
      <circle cx="32" cy="52" r="2" fill={PALETTE.tang} />
    </svg>
  );
}

function PawHouseSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 32 32 14l24 18" stroke={PALETTE.pine} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="32" cy="42" rx="8" ry="7" fill={PALETTE.sun} />
      <ellipse cx="21" cy="32" rx="4" ry="5" fill={PALETTE.sun} />
      <ellipse cx="43" cy="32" rx="4" ry="5" fill={PALETTE.sun} />
      <ellipse cx="26" cy="26" rx="3.5" ry="4.5" fill={PALETTE.sun} />
      <ellipse cx="38" cy="26" rx="3.5" ry="4.5" fill={PALETTE.sun} />
    </svg>
  );
}

function CalendarSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="10" y="14" width="44" height="40" rx="8" fill={PALETTE.white} stroke={PALETTE.pine} strokeWidth="3.5" />
      <rect x="10" y="14" width="44" height="12" rx="6" fill={PALETTE.pine} />
      <line x1="22" y1="8" x2="22" y2="20" stroke={PALETTE.pineDeep} strokeWidth="4" strokeLinecap="round" />
      <line x1="42" y1="8" x2="42" y2="20" stroke={PALETTE.pineDeep} strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="40" r="6" fill={PALETTE.sun} />
    </svg>
  );
}

function ChatSvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M10 14h44v28H32l-10 8v-8H10Z" fill={PALETTE.cream} stroke={PALETTE.tang} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="24" cy="28" r="3" fill={PALETTE.tang} />
      <circle cx="34" cy="28" r="3" fill={PALETTE.tang} />
      <circle cx="44" cy="28" r="3" fill={PALETTE.tang} opacity="0.5" />
    </svg>
  );
}

function TrophySvg() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M22 10h20v16a10 10 0 0 1-20 0Z" fill={PALETTE.sun} stroke={PALETTE.gold} strokeWidth="3" />
      <path d="M22 16H12a8 8 0 0 0 10 10M42 16h10a8 8 0 0 1-10 10" stroke={PALETTE.gold} strokeWidth="3" strokeLinecap="round" />
      <rect x="28" y="36" width="8" height="8" fill={PALETTE.gold} />
      <rect x="20" y="44" width="24" height="8" rx="4" fill={PALETTE.cocoa} />
      <path d="M32 14l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6Z" fill={PALETTE.white} />
    </svg>
  );
}

const ILLUSTRATIONS: Record<IllustrationKind, () => React.ReactElement> = {
  mission: MissionSvg,
  celebrate: CelebrateSvg,
  growth: GrowthSvg,
  pet: PetSvg,
  family: FamilySvg,
  wonder: WonderSvg,
  shield: ShieldSvg,
  spark: SparkSvg,
  journey: JourneySvg,
  hands: HandsSvg,
  book: BookSvg,
  stethoscope: StethoscopeSvg,
  "paw-house": PawHouseSvg,
  calendar: CalendarSvg,
  chat: ChatSvg,
  trophy: TrophySvg,
};

export function TtIllustration({
  kind,
  className = "size-16",
}: {
  kind: IllustrationKind;
  className?: string;
}) {
  const Svg = ILLUSTRATIONS[kind];
  return <span className={`inline-block ${className}`} role="img" aria-hidden="true"><Svg /></span>;
}
