"use client";

/**
 * Trait Garden — the 7 Thrivers traits as living plants, not scores.
 * No numbers. No decimals. No "needs nurture" labels.
 * Growth shown visually: seed → sprout → budding → blooming.
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
  // Each trait gets a slightly different plant silhouette
  const palettes: Record<string, { stem: string; leaf: string; bloom: string }> = {
    Perseverance: { stem: "#165a4b", leaf: "#22c55e", bloom: "#4ade80" },
    Empathy: { stem: "#1e3a8a", leaf: "#60a5fa", bloom: "#93c5fd" },
    Confidence: { stem: "#7a4b12", leaf: "#f4b400", bloom: "#ffd166" },
    "Self-control": { stem: "#0f766e", leaf: "#2dd4bf", bloom: "#99f6e4" },
    Curiosity: { stem: "#6d3ed1", leaf: "#a855f7", bloom: "#c4b5fd" },
    Integrity: { stem: "#92400e", leaf: "#f59e0b", bloom: "#fcd34d" },
    Optimism: { stem: "#be123c", leaf: "#fb7185", bloom: "#fda4af" },
  };
  const p = palettes[trait] ?? { stem: "#165a4b", leaf: "#22c55e", bloom: "#4ade80" };

  return (
    <svg viewBox="0 0 64 72" className="size-16" aria-hidden="true">
      {/* soil */}
      <ellipse cx="32" cy="64" rx="20" ry="6" fill="#d6c9a8" />
      {stage === "seed" && (
        <ellipse cx="32" cy="58" rx="7" ry="5" fill="#a08c5b" />
      )}
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
    </svg>
  );
}

export function TraitGarden({
  traits,
  childName,
}: {
  traits: TraitGrowth[];
  childName: string;
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
    </section>
  );
}
