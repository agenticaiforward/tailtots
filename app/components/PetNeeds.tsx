/**
 * PetNeeds — any pet as a living companion, not a decoration.
 *
 * Six needs (hunger, attention, energy, cleanliness, exercise + derived
 * happiness), species-aware labels, track-aware fulfillment:
 *   real    — real-world care check-ins (Biscuit got fed? walked?)
 *   virtual — in-app interactions (tap, feed button, missions)
 *   shelter — visits, kindness missions, donations
 *
 * Each need-state has a DISTINCT visual so a 5-year-old can READ the pet
 * without reading text: tummy rumble, stink lines, heavy eyelids,
 * head-tilt, bouncing, sparkles.
 *
 * All animations: CSS transform/opacity only, 60fps, and every looping
 * animation is disabled under prefers-reduced-motion (see globals.css).
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assertNoGuilt,
  celebrateMission,
  cleanPet,
  currentSignal,
  exercisePet,
  feedPet,
  fulfillmentHint,
  happinessFrom,
  loadNeeds,
  needLevel,
  playWithPet,
  saveNeeds,
  setSleeping,
  tapPet,
  welcomeBackLine,
  type CareContext,
  type NeedKind,
  type NeedSignalKind,
  type PetNeedsState,
  type PetSpecies,
} from "../../lib/pet-needs";
import { PetBuddyFace, type PetKind } from "./pet-buddy";

const NEED_META: Record<NeedKind | "happiness", { icon: string; label: string }> = {
  hunger: { icon: "🍎", label: "Tummy" },
  attention: { icon: "💛", label: "Love" },
  energy: { icon: "😴", label: "Energy" },
  cleanliness: { icon: "🧹", label: "Clean" },
  exercise: { icon: "🏃", label: "Active" },
  happiness: { icon: "✨", label: "Happy" },
};

/** Cute paw-print meter — fills/empties, never a clinical bar. */
function NeedMeter({
  kind,
  value,
  highlighted,
  onTap,
}: {
  kind: NeedKind | "happiness";
  value: number;
  highlighted: boolean;
  onTap: () => void;
}) {
  const meta = NEED_META[kind];
  const level = needLevel(value);
  const filled = Math.round((value / 100) * 5);
  return (
    <button
      onClick={onTap}
      aria-label={`${meta.label}: ${level}.`}
      className={`flex flex-col items-center rounded-2xl px-1.5 py-1.5 transition-all ${
        highlighted ? "bg-[#ffd166]/40 ring-2 ring-[#ffd166] scale-105" : "hover:bg-white/60"
      }`}
    >
      <span className="text-base" aria-hidden="true">{meta.icon}</span>
      <span className="mt-0.5 flex gap-px" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`text-[9px] ${i < filled ? "" : "opacity-25 grayscale"}`}>
            🐾
          </span>
        ))}
      </span>
      <span className="mt-0.5 text-[9px] font-black text-[#4f625b]">{meta.label}</span>
    </button>
  );
}

const FOODS = ["🍎", "🍖", "🥕", "🫐", "🧀"];

/**
 * State-specific idle animation class for the pet visual.
 * A 5-year-old glances and KNOWS: dirty = stink lines, tired = droopy, etc.
 */
function stateAnimation(signalKind: NeedSignalKind, sleeping: boolean): string {
  if (sleeping) return "pet-sleepy";
  switch (signalKind) {
    case "hungry":
      return "pet-tummy-rumble";
    case "dirty":
      return "pet-embarrassed";
    case "sleepy":
      return "pet-droopy";
    case "wantsPlay":
      return "pet-head-tilt";
    case "needsExercise":
      return "pet-bouncy";
    case "happy":
      return "pet-joyful";
    case "needsLove":
      return "pet-gentle-sway";
    case "resting":
      return "pet-sleepy";
    default:
      return "pet-egg-wobble";
  }
}

/** State overlays: stink lines, thought bubbles, etc. */
function StateOverlays({ signalKind }: { signalKind: NeedSignalKind }) {
  switch (signalKind) {
    case "hungry":
      return (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-2xl bg-white/95 px-2 py-1 text-lg shadow-sm ring-1 ring-[#ded8c7]"
          style={{ animation: "reward-pop 1.8s ease-in-out infinite" }} aria-hidden="true">
          🍽️💭
        </span>
      );
    case "dirty":
      return (
        <>
          <span className="stink-line absolute left-2 top-4 text-lg" aria-hidden="true">〰️</span>
          <span className="stink-line absolute right-3 top-8 text-base" style={{ animationDelay: "0.5s" }} aria-hidden="true">〰️</span>
          <span className="stink-line absolute left-5 top-12 text-sm" style={{ animationDelay: "1s" }} aria-hidden="true">〰️</span>
        </>
      );
    case "wantsPlay":
      return (
        <span className="absolute -top-2 -right-1 text-xl" style={{ animation: "pet-excited 1.2s ease-in-out infinite" }} aria-hidden="true">
          👋
        </span>
      );
    case "needsExercise":
      return (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl" style={{ animation: "pet-bouncy 0.8s ease-in-out infinite" }} aria-hidden="true">
          🏃💨
        </span>
      );
    case "happy":
      return (
        <>
          <span className="absolute -top-1 -left-1 text-base" style={{ animation: "reward-pop 2s ease-in-out infinite" }} aria-hidden="true">✨</span>
          <span className="absolute -top-2 right-4 text-sm" style={{ animation: "reward-pop 2s ease-in-out 0.6s infinite" }} aria-hidden="true">💛</span>
        </>
      );
    default:
      return null;
  }
}

/** Illustrated egg that wobbles, glows, and invites interaction. */
function LivingEgg({
  needsGlow,
  onTap,
  tapWiggleKey,
  signalKind,
}: {
  needsGlow: boolean;
  onTap: () => void;
  tapWiggleKey: number;
  signalKind: NeedSignalKind;
}) {
  return (
    <button
      onClick={onTap}
      aria-label="Tap the egg to say hi"
      className="relative grid size-28 place-items-center sm:size-32"
      style={{ animation: tapWiggleKey > 0 ? `pet-tap-wiggle 0.5s ease-out, pet-egg-wobble 3.2s ease-in-out 0.5s infinite` : `pet-egg-wobble 3.2s ease-in-out infinite` }}
      key={tapWiggleKey}
    >
      <div
        className="absolute -inset-3 rounded-full blur-xl transition-opacity duration-1000"
        style={{ background: "#ffd166", opacity: needsGlow ? 0.45 : 0.12 }}
        aria-hidden="true"
      />
      <svg viewBox="0 0 100 120" className="relative h-full w-full drop-shadow-lg" aria-hidden="true">
        <path
          d="M50 6 C74 6 90 44 90 74 C90 100 72 114 50 114 C28 114 10 100 10 74 C10 44 26 6 50 6 Z"
          fill="#fff7e6"
          stroke="#e8c76a"
          strokeWidth="3"
        />
        <path d="M30 40 C36 28 44 20 50 18" stroke="#ffe9b8" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9" />
        <circle cx="38" cy="62" r="3.5" fill="#4f625b" />
        <circle cx="62" cy="62" r="3.5" fill="#4f625b" />
        <circle cx="39.5" cy="60.5" r="1.2" fill="#fff" />
        <circle cx="63.5" cy="60.5" r="1.2" fill="#fff" />
        <path d="M44 74 Q50 78 56 74" stroke="#4f625b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="30" cy="70" rx="5" ry="3.5" fill="#ffb3a7" opacity="0.7" />
        <ellipse cx="70" cy="70" rx="5" ry="3.5" fill="#ffb3a7" opacity="0.7" />
      </svg>
      <StateOverlays signalKind={signalKind} />
      <span
        className="absolute -top-1 right-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black text-[#17231f] shadow-sm ring-1 ring-[#ded8c7]"
        style={{ animation: "reward-pop 2.4s ease-in-out infinite" }}
      >
        tap me!
      </span>
    </button>
  );
}

export function PetNeeds({
  petName,
  petKind,
  photoUrl,
  isEgg,
  compact = false,
  onMissionCelebrated,
  evolutionEmoji,
  evolutionName,
  evolutionProgress,
  species = "pet",
  careContext = "virtual",
}: {
  petName: string;
  petKind: PetKind;
  photoUrl?: string;
  /** True when the pet hasn't hatched yet — shows the living egg. */
  isEgg: boolean;
  compact?: boolean;
  /** Parent can pass a counter that increments on mission completion. */
  onMissionCelebrated?: number;
  /** Evolution stage badge (from PetEvolution helpers). */
  evolutionEmoji?: string;
  evolutionName?: string;
  /** 0–1 progress toward next evolution stage. */
  evolutionProgress?: number;
  /** Species for species-aware labels. */
  species?: PetSpecies;
  /** Care context: real pet, virtual companion, or shelter animal. */
  careContext?: CareContext;
}) {
  // Lazy-init from localStorage (runs once, no effect setState needed)
  const [initial] = useState(() => {
    if (typeof window === "undefined") return null;
    return loadNeeds();
  });
  const [needs, setNeeds] = useState<PetNeedsState | null>(initial?.state ?? null);
  const [hoursAway] = useState(initial?.hoursAway ?? 0);
  const [showWelcome, setShowWelcome] = useState((initial?.hoursAway ?? 0) >= 1);
  const [showFeedMenu, setShowFeedMenu] = useState(false);
  const [hintNeed, setHintNeed] = useState<NeedKind | "happiness" | null>(null);
  const [tapWiggleKey, setTapWiggleKey] = useState(0);
  const [justFed, setJustFed] = useState<string | null>(null);
  const [justCleaned, setJustCleaned] = useState(false);
  const [justExercised, setJustExercised] = useState(false);
  const prevCelebrated = useRef(onMissionCelebrated);

  // Persist on change
  useEffect(() => {
    if (needs) saveNeeds(needs);
  }, [needs]);

  // Mission celebration feeds happiness
  useEffect(() => {
    if (onMissionCelebrated !== undefined && prevCelebrated.current !== undefined && onMissionCelebrated !== prevCelebrated.current) {
      setNeeds((n) => (n ? celebrateMission(n) : n));
    }
    prevCelebrated.current = onMissionCelebrated;
  }, [onMissionCelebrated]);

  const update = useCallback((fn: (s: PetNeedsState) => PetNeedsState) => {
    setNeeds((n) => (n ? fn(n) : n));
  }, []);

  const signal = useMemo(() => (needs ? currentSignal(needs, petName, species) : null), [needs, petName, species]);
  const happiness = useMemo(() => (needs ? happinessFrom(needs) : 0), [needs]);
  const needsGlow = useMemo(() => (needs ? happinessFrom(needs) >= 60 : false), [needs]);
  const animClass = useMemo(
    () => (signal && needs ? stateAnimation(signal.kind, needs.sleeping) : "pet-egg-wobble"),
    [signal, needs]
  );

  const handleTapPet = useCallback(() => {
    setTapWiggleKey((k) => k + 1);
    update((s) => tapPet(s));
  }, [update]);

  const handleFeed = useCallback(
    (food: string) => {
      update((s) => feedPet(s));
      setJustFed(food);
      setShowFeedMenu(false);
      window.setTimeout(() => setJustFed(null), 1800);
    },
    [update]
  );

  const handleFeedCheckin = useCallback(() => {
    // Real/shelter track: confirm the real-world feeding happened
    update((s) => feedPet(s));
    setJustFed("✅");
    window.setTimeout(() => setJustFed(null), 1800);
  }, [update]);

  const handlePlay = useCallback(() => {
    update((s) => playWithPet(s));
    setTapWiggleKey((k) => k + 1);
  }, [update]);

  const handleClean = useCallback(() => {
    update((s) => cleanPet(s));
    setJustCleaned(true);
    window.setTimeout(() => setJustCleaned(null), 1800);
  }, [update]);

  const handleExercise = useCallback(() => {
    update((s) => exercisePet(s));
    setJustExercised(true);
    window.setTimeout(() => setJustExercised(null), 1800);
  }, [update]);

  const handleSleepToggle = useCallback(() => {
    update((s) => setSleeping(s, !s.sleeping));
  }, [update]);

  if (!needs || !signal) return null;

  // Validate the signal line (dev/test throws on guilt; prod falls back)
  let signalLine = signal.line;
  try {
    assertNoGuilt(signalLine);
  } catch {
    signalLine = `${petName} is here with you 💛`;
  }

  const values: Record<NeedKind | "happiness", number> = {
    hunger: needs.hunger,
    attention: needs.attention,
    energy: needs.energy,
    cleanliness: needs.cleanliness,
    exercise: needs.exercise,
    happiness,
  };

  const isRealWorld = careContext === "real" || careContext === "shelter";

  return (
    <div className={`overflow-hidden rounded-3xl border border-[#ded8c7] bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
      {/* Welcome back — warm, never guilt */}
      {showWelcome && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-[#ffd166]/25 px-3 py-2">
          <p className="text-sm font-extrabold text-[#17231f]">{welcomeBackLine(hoursAway, petName)}</p>
          <button
            onClick={() => setShowWelcome(false)}
            className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#4f625b]"
            aria-label="Dismiss welcome"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* The pet — tappable! */}
        <div className="relative shrink-0">
          {isEgg ? (
            <LivingEgg needsGlow={needsGlow} onTap={handleTapPet} tapWiggleKey={tapWiggleKey} signalKind={signal.kind} />
          ) : (
            <button onClick={handleTapPet} aria-label={`Tap ${petName} to say hi`} className="relative block">
              <div className="size-28 sm:size-32" style={{ animation: `${animClass} 2.8s ease-in-out infinite` }}>
                <PetBuddyFace kind={petKind} photoUrl={photoUrl} label={petName} size="lg" className="!size-full" />
              </div>
              <StateOverlays signalKind={signal.kind} />
              {needs.sleeping && (
                <span className="zzz-float absolute -right-1 top-0 text-xl" aria-hidden="true">💤</span>
              )}
              {justFed && (
                <span className="absolute inset-0 grid place-items-center text-4xl" style={{ animation: "reward-pop 1.8s ease-out forwards" }} aria-hidden="true">
                  {justFed}
                </span>
              )}
              {justCleaned && (
                <span className="absolute inset-0 grid place-items-center text-4xl" style={{ animation: "reward-pop 1.8s ease-out forwards" }} aria-hidden="true">
                  ✨🧼✨
                </span>
              )}
              {justExercised && (
                <span className="absolute inset-0 grid place-items-center text-4xl" style={{ animation: "reward-pop 1.8s ease-out forwards" }} aria-hidden="true">
                  🏃💨
                </span>
              )}
            </button>
          )}
        </div>

        {/* Signal + action */}
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-[#17231f]">{signalLine}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {signal.kind === "hungry" &&
              (isRealWorld ? (
                <button onClick={handleFeedCheckin} className="tt-btn-press rounded-2xl bg-[#ffd166] px-4 py-2 text-sm font-black text-[#17231f]">
                  {careContext === "shelter" ? `Helped feed ${petName} ✅` : `${petName} got fed! ✅`}
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowFeedMenu((v) => !v)}
                    className="tt-btn-press rounded-2xl bg-[#ffd166] px-4 py-2 text-sm font-black text-[#17231f]"
                  >
                    {signal.actionLabel} 🍎
                  </button>
                  {showFeedMenu && (
                    <div className="absolute left-0 top-full z-20 mt-2 flex gap-1.5 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-[#ded8c7]">
                      {FOODS.map((f) => (
                        <button
                          key={f}
                          onClick={() => handleFeed(f)}
                          className="rounded-xl p-1.5 text-2xl transition-transform hover:scale-125"
                          aria-label={`Feed ${f}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            {(signal.kind === "wantsPlay" || signal.kind === "needsLove") && (
              <button onClick={handlePlay} className="tt-btn-press rounded-2xl bg-[#ffd166] px-4 py-2 text-sm font-black text-[#17231f]">
                {isRealWorld && careContext === "real"
                  ? `Played with ${petName}! 💛`
                  : isRealWorld
                    ? `Sent ${petName} love! 💛`
                    : `${signal.actionLabel} 💛`}
              </button>
            )}
            {signal.kind === "dirty" && (
              <button onClick={handleClean} className="tt-btn-press rounded-2xl bg-[#7dd3fc] px-4 py-2 text-sm font-black text-[#17231f]">
                {isRealWorld && careContext === "real" ? `Cleaned up! 🧼` : `${signal.actionLabel} 🧼`}
              </button>
            )}
            {signal.kind === "needsExercise" && (
              <button onClick={handleExercise} className="tt-btn-press rounded-2xl bg-[#86efac] px-4 py-2 text-sm font-black text-[#17231f]">
                {isRealWorld && careContext === "real" ? `Exercised together! 🏃` : `${signal.actionLabel} 🏃`}
              </button>
            )}
            {signal.kind === "sleepy" && (
              <button onClick={handleSleepToggle} className="tt-btn-press rounded-2xl bg-[#1e3a8a] px-4 py-2 text-sm font-black text-white">
                {signal.actionLabel} 😴
              </button>
            )}
            {signal.kind === "resting" && (
              <button onClick={handleSleepToggle} className="tt-btn-press rounded-2xl bg-[#ffd166] px-4 py-2 text-sm font-black text-[#17231f]">
                {signal.actionLabel} ☀️
              </button>
            )}
            {signal.kind === "happy" && (
              <button onClick={handleTapPet} className="tt-btn-press rounded-2xl bg-[#e8f5e0] px-4 py-2 text-sm font-black text-[#17231f]">
                {signal.actionLabel} 👋
              </button>
            )}
            {!needs.sleeping && signal.kind !== "sleepy" && (
              <button
                onClick={handleSleepToggle}
                className="rounded-2xl px-3 py-2 text-xs font-black text-[#4f625b] ring-1 ring-[#ded8c7]"
                aria-label={`Tuck ${petName} in for a nap`}
              >
                😴 Nap
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cute needs meters — six total */}
      <div className="mt-3 grid grid-cols-6 gap-1 border-t border-[#f0ece0] pt-3">
        {(Object.keys(values) as (NeedKind | "happiness")[]).map((k) => (
          <NeedMeter
            key={k}
            kind={k}
            value={values[k]}
            highlighted={signal.need === k}
            onTap={() => setHintNeed(hintNeed === k ? null : k)}
          />
        ))}
      </div>
      {hintNeed && (
        <p className="mt-2 rounded-2xl bg-[#faf8f0] px-3 py-2 text-center text-xs font-bold text-[#4f625b]">
          {NEED_META[hintNeed].icon} {hintNeed === "happiness"
            ? "Grows when all other needs are met!"
            : fulfillmentHint(hintNeed, careContext, petName, species)}
        </p>
      )}
      {/* Evolution stage badge + progress */}
      {evolutionEmoji && evolutionName && (
        <div className="mt-3 flex items-center gap-2 border-t border-[#f0ece0] pt-3">
          <span className="rounded-full bg-[#17231f] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd166]">
            {evolutionEmoji} {evolutionName}
          </span>
          {evolutionProgress !== undefined && evolutionProgress < 1 && (
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f0ece0]">
              <div
                className="h-full rounded-full bg-[#ffd166] transition-all duration-500"
                style={{ width: `${Math.round(evolutionProgress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
