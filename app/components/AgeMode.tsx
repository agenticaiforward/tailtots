/**
 * AgeMode — the TailTots age ladder.
 *
 * Three genuinely different kid experiences, not reskins:
 *   🌱 Sprout (ages 4-6):   big touch targets, voice-first, minimal text,
 *                            parent co-do emphasis. Bright, playful, simple.
 *   🌿 Grow (ages 7-9):      mission cards, simple goals, pet companion
 *                            prominent. More independence, still playful.
 *   🌳 Thrive (ages 10-12):  project-based challenges, real-world impact
 *                            framing, "who you're becoming" language.
 *                            More mature design, less cartoonish.
 *
 * The mode is derived from the child's age. The transition predictor
 * (lib/ai/transition-predictor.ts, when available) can trigger early
 * graduation; otherwise age bands decide.
 */

export type AgeMode = "sprout" | "grow" | "thrive";

/** Clamp any age into a ladder mode. Ages 3 and under join Sprout; 13+ stays in Thrive. */
export function getAgeMode(age: number): AgeMode {
  if (age <= 6) return "sprout";
  if (age <= 9) return "grow";
  return "thrive";
}

/** Next mode up the ladder, or null when already at the top. */
export function nextAgeMode(mode: AgeMode): AgeMode | null {
  if (mode === "sprout") return "grow";
  if (mode === "grow") return "thrive";
  return null;
}

export type AgeModeMeta = {
  mode: AgeMode;
  emoji: string;
  name: string;
  tagline: string;
  /** Kid-facing "you are here" line. */
  kidLine: string;
  /** Parent-facing label for what this stage is about. */
  parentLine: string;
  /** Shell background for the kid experience. */
  shellBg: string;
  /** Accent color classes for headers/buttons in this mode. */
  accentBg: string;
  accentText: string;
  accentRing: string;
  /** Graduation headline when arriving in this mode. */
  welcomeHeadline: (childName: string) => string;
  welcomeSub: string;
};

export const AGE_MODE_META: Record<AgeMode, AgeModeMeta> = {
  sprout: {
    mode: "sprout",
    emoji: "🌱",
    name: "Sprout",
    tagline: "Little helpers, big hearts",
    kidLine: "You're a Sprout — growing big and kind!",
    parentLine: "Ages 4–6 · co-do missions, voice-first, grown-up nearby",
    shellBg: "bg-gradient-to-b from-[#fff9e8] via-[#fffdf4] to-[#faf8f0]",
    accentBg: "bg-[#f4b400]",
    accentText: "text-[#7a4b12]",
    accentRing: "ring-[#f4b400]",
    welcomeHeadline: (n) => `${n} is a Sprout! 🌱`,
    welcomeSub: "Time for little missions, big hugs, and growing together.",
  },
  grow: {
    mode: "grow",
    emoji: "🌿",
    name: "Grow",
    tagline: "Building skills every day",
    kidLine: "You're in Grow — taking on bigger missions!",
    parentLine: "Ages 7–9 · independent missions, goals, pet companion",
    shellBg: "bg-gradient-to-b from-[#eefbf3] via-[#f7fdf9] to-[#faf8f0]",
    accentBg: "bg-[#165a4b]",
    accentText: "text-[#0d3b30]",
    accentRing: "ring-[#165a4b]",
    welcomeHeadline: (n) => `Welcome to Grow, ${n}! 🌿`,
    welcomeSub: "Bigger missions, braver tries, and your pet is counting on you.",
  },
  thrive: {
    mode: "thrive",
    emoji: "🌳",
    name: "Thrive",
    tagline: "Becoming who you're meant to be",
    kidLine: "You're thriving — real projects, real impact.",
    parentLine: "Ages 10–12 · projects, real-world impact, mentoring",
    shellBg: "bg-gradient-to-b from-[#eef0fb] via-[#f6f7fd] to-[#faf8f0]",
    accentBg: "bg-[#2b2f6b]",
    accentText: "text-[#1c1f4a]",
    accentRing: "ring-[#2b2f6b]",
    welcomeHeadline: (n) => `${n}, you're ready to Thrive 🌳`,
    welcomeSub: "Real projects. Real impact. This is where you find out what you're made of.",
  },
};

/* ------------------------------------------------------------------ */
/* KidModeHeader — mode-specific welcome header for the kid view.       */
/* Each mode FEELS different: Sprout is giant + voice-first, Grow is   */
/* goal-driven with the pet front and center, Thrive is project/impact */
/* framed with a more mature voice.                                    */
/* ------------------------------------------------------------------ */

export function KidModeHeader({
  mode,
  childName,
  petName,
  openMissionCount,
  completedCount,
}: {
  mode: AgeMode;
  childName: string;
  petName?: string;
  openMissionCount: number;
  completedCount: number;
}) {
  const meta = AGE_MODE_META[mode];

  if (mode === "sprout") {
    // SPROUT: giant, warm, voice-first. Minimal text. Parent co-do ribbon.
    return (
      <div className={`overflow-hidden rounded-3xl border-2 border-[#f4b400]/60 ${meta.shellBg} p-5 text-center shadow-sm sm:p-7`}>
        <p className="text-5xl sm:text-6xl" aria-hidden="true">
          <span className="inline-block animate-[pet-wiggle_2.4s_ease-in-out_infinite]">{meta.emoji}</span>
        </p>
        <h2 className="mt-3 text-3xl font-black text-[#17231f] sm:text-4xl">Hi, {childName}! 👋</h2>
        <p className="mx-auto mt-2 max-w-sm text-lg font-bold leading-7 text-[#4f625b]">
          {petName ? `${petName} missed you! ` : ""}Tap a big mission below and do it <span className="text-[#7a4b12]">together</span> with a grown-up.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#fff4d8] px-4 py-2 text-sm font-black text-[#7a4b12] ring-1 ring-[#f4b400]/50">
          <span aria-hidden="true">🤝</span> Grown-up helper missions
        </div>
        {openMissionCount > 0 && (
          <p className="mt-3 text-base font-black text-[#165a4b]">
            {openMissionCount} fun {openMissionCount === 1 ? "mission" : "missions"} waiting! 🎉
          </p>
        )}
      </div>
    );
  }

  if (mode === "grow") {
    // GROW: goal-driven, pet companion prominent, independence.
    return (
      <div className={`overflow-hidden rounded-3xl border border-[#165a4b]/25 ${meta.shellBg} p-5 shadow-sm sm:p-6`}>
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#165a4b] text-4xl shadow-md" aria-hidden="true">
            {meta.emoji}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">{meta.name} mode</p>
            <h2 className="mt-1 text-2xl font-black text-[#17231f]">Let&apos;s go, {childName}! 🚀</h2>
            <p className="mt-1 text-sm font-semibold text-[#4f625b]">
              {completedCount > 0
                ? `${completedCount} ${completedCount === 1 ? "mission" : "missions"} done so far — keep climbing!`
                : "Your missions are ready. Pick one and show what you can do!"}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/80 p-3 text-center ring-1 ring-[#ded8c7]">
            <p className="text-2xl font-black text-[#165a4b]">{openMissionCount}</p>
            <p className="text-xs font-black uppercase tracking-wide text-[#69736f]">to do</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 text-center ring-1 ring-[#ded8c7]">
            <p className="text-2xl font-black text-[#f4b400]">{completedCount}</p>
            <p className="text-xs font-black uppercase tracking-wide text-[#69736f]">done 🎉</p>
          </div>
        </div>
      </div>
    );
  }

  // THRIVE: mature, project/impact framed, "who you're becoming".
  return (
    <div className={`overflow-hidden rounded-2xl border border-[#2b2f6b]/20 ${meta.shellBg} p-5 shadow-sm sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2b2f6b]">{meta.name} · project mode</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1c1f4a] sm:text-3xl">
            {childName}, what will you build this week?
          </h2>
          <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#4f625b]">
            These aren&apos;t chores — they&apos;re projects. Real skills, real impact, real proof of who you&apos;re becoming.
          </p>
        </div>
        <div className="hidden shrink-0 text-5xl sm:block" aria-hidden="true">
          {meta.emoji}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#2b2f6b] px-3 py-1.5 text-xs font-black text-white">
          {openMissionCount} active {openMissionCount === 1 ? "project" : "projects"}
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#2b2f6b] ring-1 ring-[#2b2f6b]/25">
          {completedCount} shipped so far ✓
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AgeModeBadge — small pill identifying the child's ladder mode.      */
/* ------------------------------------------------------------------ */

export function AgeModeBadge({ age, className = "" }: { age: number; className?: string }) {
  const meta = AGE_MODE_META[getAgeMode(age)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1 ${className}`}
      title={meta.parentLine}
    >
      <span aria-hidden="true">{meta.emoji}</span> {meta.name}
    </span>
  );
}
