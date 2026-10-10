"use client";

/**
 * Trait Garden — the 8 developmental traits as living plants, not scores.
 * No numbers. No decimals. No "needs nurture" labels.
 * Growth shown visually: seed → sprout → budding → blooming.
 * Respect grows as a tree with deep roots (grounded, steady).
 * Patience appears as a special slow oak — some growth takes time.
 */

export type GardenStage = "seed" | "sprout" | "budding" | "blooming";

export interface TraitGrowth {
  trait: string;
  caption: string;
  stage: GardenStage;
  /** 0-1, used only to pick the stage — never displayed */
  _level: number;
}

export function levelToStage(level: number): GardenStage {
  if (level >= 0.75) return "blooming";
  if (level >= 0.5) return "budding";
  if (level >= 0.25) return "sprout";
  return "seed";
}

const STAGE_META: Record<GardenStage, { label: string; color: string }> = {
  seed: { label: "Just planted", color: "text-tt-ink-faint" },
  sprout: { label: "Sprouting", color: "text-tt-pine" },
  budding: { label: "Budding", color: "text-tt-tang" },
  blooming: { label: "Blooming", color: "text-tt-grape" },
};

function PlantSvg({ stage, trait }: { stage: GardenStage; trait: string }) {
  // Each trait gets a slightly different plant silhouette.
  // Respect is a tree with deep roots — grounded, steady, sheltering.
  const palettes: Record<string, { stem: string; leaf: string; bloom: string }> = {
    Perseverance: { stem: "#165a4b", leaf: "#22c55e", bloom: "#4ade80" },
    Empathy: { stem: "#1e3a8a", leaf: "#60a5fa", bloom: "#93c5fd" },
    Confidence: { stem: "#7a4b12", leaf: "#f4b400", bloom: "#ffd166" },
    "Self-control": { stem: "#0f766e", leaf: "#2dd4bf", bloom: "#99f6e4" },
    Curiosity: { stem: "#6d3ed1", leaf: "#a855f7", bloom: "#c4b5fd" },
    Integrity: { stem: "#92400e", leaf: "#f59e0b", bloom: "#fcd34d" },
    Optimism: { stem: "#be123c", leaf: "#fb7185", bloom: "#fda4af" },
    Respect: { stem: "#5b3a1e", leaf: "#4d7c0f", bloom: "#a3e635" },
  };
  const p = palettes[trait] ?? { stem: "#165a4b", leaf: "#22c55e", bloom: "#4ade80" };
  const isTree = trait === "Respect";

  return (
    <svg viewBox="0 0 64 72" className="size-16" aria-hidden="true">
      {/* soil */}
      <ellipse cx="32" cy="64" rx="20" ry="6" fill="#d6c9a8" />
      {isTree && (stage === "sprout" || stage === "budding" || stage === "blooming") && (
        <>
          {/* deep roots — respect is grounded */}
          <path d="M32 64 C30 68 26 69 22 68" stroke={p.stem} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M32 64 C34 68 38 69 42 68" stroke={p.stem} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M32 64 C32 68 32 70 32 70" stroke={p.stem} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
        </>
      )}
      {stage === "seed" && (
        <ellipse cx="32" cy="58" rx="7" ry="5" fill="#a08c5b" />
      )}
      {isTree ? (
        <>
          {(stage === "sprout" || stage === "budding" || stage === "blooming") && (
            <>
              {/* sturdy trunk */}
              <path d="M32 64 C32 50 32 40 32 30" stroke={p.stem} strokeWidth="6" fill="none" strokeLinecap="round" />
              {/* branches */}
              <path d="M32 44 C26 40 22 36 20 30" stroke={p.stem} strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M32 40 C38 36 42 32 44 26" stroke={p.stem} strokeWidth="3" fill="none" strokeLinecap="round" />
            </>
          )}
          {(stage === "budding" || stage === "blooming") && (
            <>
              {/* canopy */}
              <ellipse cx="32" cy="22" rx="16" ry="11" fill={p.leaf} opacity="0.85" />
              <ellipse cx="24" cy="26" rx="9" ry="7" fill={p.leaf} opacity="0.7" />
              <ellipse cx="40" cy="26" rx="9" ry="7" fill={p.leaf} opacity="0.7" />
            </>
          )}
          {stage === "blooming" && (
            <>
              <circle cx="28" cy="20" r="3" fill={p.bloom} />
              <circle cx="36" cy="24" r="3" fill={p.bloom} opacity="0.85" />
              <circle cx="32" cy="16" r="2.5" fill={p.bloom} opacity="0.7" />
              {/* sparkles */}
              <path d="M50 12l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill={p.bloom} opacity="0.9" />
            </>
          )}
        </>
      ) : (
        <>
      {(stage === "sprout" || stage === "budding" || stage === "blooming") && (
        <>
          <path d="M32 62 C32 48 31 40 28 32" stroke={p.stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="24" cy="44" rx="8" ry="4.5" fill={p.leaf} transform="rotate(-25 24 44)" />
        </>
      )}
      {(stage === "budding" || stage === "blooming") && (
        <>
          <path d="M32 62 C32 44 33 34 37 26" stroke={p.stem} strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="41" cy="38" rx="8" ry="4.5" fill={p.leaf} transform="rotate(25 41 38)" />
          <circle cx="37" cy="24" r="5" fill={p.bloom} opacity="0.7" />
        </>
      )}
      {stage === "blooming" && (
        <>
          <circle cx="28" cy="28" r="7" fill={p.bloom} />
          <circle cx="37" cy="22" r="6" fill={p.bloom} opacity="0.85" />
          <circle cx="32" cy="18" r="2.5" fill="#fff" />
          <circle cx="28" cy="28" r="2.5" fill="#fff" opacity="0.8" />
          {/* sparkles */}
          <path d="M48 14l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill={p.bloom} opacity="0.9" />
          <path d="M14 20l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" fill={p.bloom} opacity="0.7" />
        </>
      )}
        </>
      )}
    </svg>
  );
}

export interface PatienceOak {
  /** Kid-friendly caption, e.g. "Maya waited 3 turns today" */
  caption: string;
  /** 0..1 — patience grows slowly by design */
  level: number;
}

export function TraitGarden({
  traits,
  childName,
  patienceOak,
}: {
  traits: TraitGrowth[];
  childName: string;
  /**
   * Optional patience oak: a special slow-growing element. Patience is a
   * skill, not a ninth trait — the oak teaches that some growth is slow,
   * and that's the point.
   */
  patienceOak?: PatienceOak;
}) {
  const blooming = traits.filter((t) => t.stage === "blooming").length;

  return (
    <section className="rounded-3xl border border-tt-line bg-gradient-to-b from-tt-pine-tint/50 to-tt-paper p-5" aria-label={`${childName}'s growth garden`}>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-tt-pine">Growth garden</p>
          <h3 className="mt-1 text-xl font-black text-tt-ink">
            {blooming > 0 ? `${blooming} ${blooming === 1 ? "strength" : "strengths"} blooming` : "Seeds are planted"}
          </h3>
        </div>
        <span className="text-3xl" aria-hidden="true">🌱</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
        Every mission waters these. Watch them grow — no scores, just growth.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {traits.map((t) => {
          const meta = STAGE_META[t.stage];
          return (
            <div
              key={t.trait}
              className="flex flex-col items-center rounded-2xl bg-tt-paper p-3 text-center shadow-sm transition-transform hover:scale-105"
            >
              <PlantSvg stage={t.stage} trait={t.trait} />
              <p className="mt-1 text-sm font-extrabold text-tt-ink">{t.trait}</p>
              <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-tt-ink-faint">{t.caption}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 rounded-2xl bg-tt-cream p-3 text-center text-xs font-bold text-tt-ink-soft">
        💛 Plants grow at their own pace. So do kids. This garden compares {childName} to nobody but last week's {childName}.
      </p>

      {patienceOak && (
        <div className="mt-3 flex items-center gap-4 rounded-2xl border border-tt-line bg-gradient-to-r from-tt-cream to-tt-paper p-4">
          <svg viewBox="0 0 64 72" className="size-14 shrink-0" aria-hidden="true">
            <ellipse cx="32" cy="64" rx="20" ry="6" fill="#d6c9a8" />
            {/* ancient oak trunk — thick, slow, steady */}
            <path d="M32 64 C31 48 33 34 32 22" stroke="#5b3a1e" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M32 50 C24 46 20 40 18 34" stroke="#5b3a1e" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M32 44 C40 40 44 34 46 28" stroke="#5b3a1e" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* broad, patient canopy */}
            <ellipse cx="32" cy="18" rx="18" ry="12" fill="#4d7c0f" opacity="0.8" />
            <ellipse cx="22" cy="22" rx="10" ry="8" fill="#65a30d" opacity="0.7" />
            <ellipse cx="42" cy="22" rx="10" ry="8" fill="#65a30d" opacity="0.7" />
            {/* deep roots */}
            <path d="M32 64 C28 68 24 69 20 68" stroke="#5b3a1e" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M32 64 C36 68 40 69 44 68" stroke="#5b3a1e" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
          </svg>
          <div>
            <p className="text-sm font-extrabold text-tt-ink">🌳 The Slow Oak — Patience</p>
            <p className="mt-0.5 text-xs leading-relaxed text-tt-ink-soft">{patienceOak.caption}</p>
            <p className="mt-1 text-[11px] font-bold text-tt-ink-faint">
              Oaks grow slower than sprouts — and stand taller. Some growth takes time, and that's the point.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
