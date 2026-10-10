/**
 * CelebrationEngine — Duolingo-grade 5-beat celebration sequence.
 *
 * On mission completion, the kid gets a full sensory sequence:
 *   Beat 1 (~0.5s): stars burst — 3 stars fly in curved arcs to the reward display
 *   Beat 2 (~1s):   XP/points count-up with accelerating count + reward SFX
 *   Beat 3 (~0.5s): particle burst — leaves/stars/paw-prints (themed, never lightning)
 *   Beat 4 (~1s):   reward cards fan out one by one (points, trait, streak)
 *   Beat 5:         final summary + pet celebrate animation + Continue
 *
 * Total 3–4s, skippable via tap. Confetti rain is reserved for MILESTONES
 * only (pass `milestone`) — everyday completions get the 5 beats, preserving
 * the dopamine hierarchy per the design research.
 *
 * Honors prefers-reduced-motion: jumps straight to the final screen.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PetBuddyFace, type PetKind } from "./pet-buddy";
import { playChime, playStarBurst, playPop, playFanfare } from "../../lib/sound";

export type CelebrationReward = {
  icon: string;
  title: string;
  detail: string;
};

const PARTICLES = ["🍃", "⭐", "🐾", "🌸", "✨", "🍀", "💛", "🌟"];

function prefersReducedMotionNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotionNow);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function CelebrationEngine({
  missionTitle,
  points,
  coins,
  rewards = [],
  petName,
  petKind,
  petPhotoUrl,
  streakLabel,
  milestone = false,
  headline,
  onDone,
}: {
  missionTitle: string;
  points: number;
  coins: number;
  rewards?: CelebrationReward[];
  petName?: string;
  petKind?: PetKind;
  petPhotoUrl?: string;
  streakLabel?: string;
  /** Milestones (evolution, graduation) get confetti rain + fanfare. */
  milestone?: boolean;
  headline?: string;
  onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  // Beats: 0 = stars, 1 = count-up, 2 = particles, 3 = cards, 4 = final
  const [beat, setBeat] = useState(reducedMotion ? 4 : 0);
  const [counted, setCounted] = useState(reducedMotion ? points : 0);
  const [ticking, setTicking] = useState(false);
  const doneRef = useRef(false);

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        icon: PARTICLES[i % PARTICLES.length],
        x: Math.cos((i / 18) * Math.PI * 2) * (60 + (i % 5) * 22),
        y: Math.sin((i / 18) * Math.PI * 2) * (50 + (i % 4) * 18) - 40,
        r: (i * 47) % 360,
        delay: (i % 6) * 0.03,
        size: 16 + (i % 3) * 6,
      })),
    []
  );

  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        icon: PARTICLES[(i * 3) % PARTICLES.length],
        left: (i * 37) % 100,
        delay: (i % 10) * 0.12,
        size: 14 + (i % 4) * 5,
      })),
    []
  );

  // Beat sequencer
  useEffect(() => {
    if (reducedMotion) return;
    playStarBurst();
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setBeat(1), 550)); // stars land → count-up
    timers.push(setTimeout(() => setBeat(2), 1600)); // count done → particles
    timers.push(setTimeout(() => setBeat(3), 2150)); // particles → cards
    timers.push(setTimeout(() => setBeat(4), 3300)); // cards → final
    return () => timers.forEach(clearTimeout);
  }, [reducedMotion]);

  // Count-up animation during beat 1
  useEffect(() => {
    if (beat !== 1 || reducedMotion) return;
    playChime();
    const start = performance.now();
    const dur = 950;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic: fast start, gentle land
      setCounted(Math.round(eased * points));
      setTicking(true);
      if (p < 1) raf = requestAnimationFrame(step);
      else setTicking(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [beat, points, reducedMotion]);

  // Card pop sounds during beat 3
  useEffect(() => {
    if (beat !== 3 || reducedMotion) return;
    rewards.forEach((_, i) => setTimeout(() => playPop(), i * 280));
    if (milestone) playFanfare();
  }, [beat, rewards, milestone, reducedMotion]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#17231f]/70 p-4 backdrop-blur-sm"
      onClick={finish}
      role="dialog"
      aria-modal="true"
      aria-label={headline ?? "Mission complete!"}
    >
      {milestone && beat >= 3 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="celeb-confetti absolute top-0"
              style={{ left: `${c.left}%`, fontSize: c.size, animationDelay: `${c.delay}s` }}
            >
              {c.icon}
            </span>
          ))}
        </div>
      )}

      <div
        className="tt-animate-pop-in relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-[#fffdf4] p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pet celebrate — the emotional anchor */}
        {beat >= 2 && petKind && (
          <div className="pet-celebrate mx-auto -mt-2 size-24" aria-hidden="true">
            <PetBuddyFace kind={petKind} photoUrl={petPhotoUrl} label={petName ?? "pet"} size="lg" className="!size-full" />
          </div>
        )}

        <h2 className="mt-2 text-2xl font-black text-[#17231f]">{headline ?? "You did it!"}</h2>
        <p className="mt-1 text-sm font-bold text-[#4f625b]">{missionTitle}</p>

        {/* Beat 1: stars burst */}
        {beat >= 0 && (
          <div className="relative mx-auto mt-4 h-16" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="celeb-star absolute left-1/2 top-1/2 text-4xl"
                style={
                  {
                    "--star-x": `${(i - 1) * 56}px`,
                    "--star-y": "-30px",
                    animationDelay: `${i * 0.12}s`,
                    marginLeft: "-1rem",
                    marginTop: "-1rem",
                  } as React.CSSProperties
                }
              >
                ⭐
              </span>
            ))}
          </div>
        )}

        {/* Beat 2: points count-up */}
        {beat >= 1 && (
          <div className="mt-1">
            <p className={`text-5xl font-black tabular-nums text-[#f47b20] ${ticking ? "celeb-count-tick" : ""}`}>
              +{beat === 1 ? counted : points}
            </p>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#69736f]">points</p>
            {coins > 0 && <p className="mt-1 text-sm font-black text-[#b45309]">+{coins} 🪙 treats</p>}
          </div>
        )}

        {/* Beat 3: particle burst */}
        {beat >= 2 && beat < 4 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            {particles.map((p, i) => (
              <span
                key={i}
                className="celeb-particle absolute"
                style={
                  {
                    "--burst-x": `${p.x}px`,
                    "--burst-y": `${p.y}px`,
                    "--burst-r": `${p.r}deg`,
                    animationDelay: `${p.delay}s`,
                    fontSize: p.size,
                  } as React.CSSProperties
                }
              >
                {p.icon}
              </span>
            ))}
          </div>
        )}

        {/* Beat 4: reward cards fan out */}
        {beat >= 3 && rewards.length > 0 && (
          <div className="mt-4 grid gap-2">
            {rewards.map((r, i) => (
              <div
                key={i}
                className="celeb-card flex items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-[#ded8c7]"
                style={{ animationDelay: `${i * 0.28}s` }}
              >
                <span className="text-3xl" aria-hidden="true">{r.icon}</span>
                <div>
                  <p className="text-sm font-black text-[#17231f]">{r.title}</p>
                  <p className="text-xs font-semibold text-[#4f625b]">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Beat 5: final */}
        {beat >= 4 && (
          <div className="mt-4">
            {streakLabel && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4d8] px-4 py-2 text-sm font-black text-[#7a4b12] ring-1 ring-[#f4b400]/40">
                🔥 {streakLabel}
              </p>
            )}
            {petName && beat >= 2 && (
              <p className="mt-3 text-sm font-bold text-[#4f625b]">
                {petName} is doing a happy dance! 💃
              </p>
            )}
            <button
              onClick={finish}
              className="tt-btn-press mt-4 min-h-14 w-full rounded-2xl bg-[#f47b20] text-lg font-black text-white"
            >
              Continue →
            </button>
            {!reducedMotion && <p className="mt-2 text-[11px] font-semibold text-[#69736f]">tap anywhere to skip</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * BraveTryCelebration — the mini-celebration for attempting hard things.
 * Distinct from completion: trying IS the joy. Shorter (2 beats), warmer,
 * never about points — about courage.
 */
export function BraveTryCelebration({
  childName,
  missionTitle,
  tryCount,
  onDone,
}: {
  childName: string;
  missionTitle: string;
  tryCount: number;
  onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [beat, setBeat] = useState(reducedMotion ? 1 : 0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) return;
    import("../../lib/sound").then((s) => s.playBraveTry());
    const t = setTimeout(() => setBeat(1), 1400);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#17231f]/70 p-4 backdrop-blur-sm"
      onClick={finish}
      role="dialog"
      aria-modal="true"
      aria-label="Brave try celebrated"
    >
      <div
        className="tt-animate-pop-in w-full max-w-sm rounded-[2rem] bg-[#fffdf4] p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={reducedMotion ? "" : "pet-encourage mx-auto size-20 text-6xl"} aria-hidden="true">
          🦁
        </div>
        <h2 className="mt-2 text-2xl font-black text-[#17231f]">Brave Try!</h2>
        <p className="mt-1 text-sm font-bold text-[#4f625b]">
          {childName} took on <span className="font-black text-[#17231f]">“{missionTitle}”</span> — a hard one!
        </p>
        {beat >= 1 && (
          <>
            <p className="celeb-card mt-4 inline-flex items-center gap-2 rounded-full bg-[#6d3ed1]/10 px-5 py-2.5 text-base font-black text-[#6d3ed1] ring-1 ring-[#6d3ed1]/30">
              💪 {tryCount} brave {tryCount === 1 ? "try" : "tries"} and counting
            </p>
            <p className="mt-3 text-sm font-semibold text-[#4f625b]">
              Trying something hard counts — finished or not. That&apos;s what bravery is.
            </p>
            <button
              onClick={finish}
              className="tt-btn-press mt-4 min-h-14 w-full rounded-2xl bg-[#6d3ed1] text-lg font-black text-white"
            >
              Keep being brave →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
