/**
 * PetNeeds — Jack's living emotional needs UI.
 *
 * A pet that doesn't need you is a decoration. This component gives Jack
 * four needs (hunger, attention, energy, derived happiness) that decay
 * over real time and are fulfilled through play — never obligation.
 *
 * Design rules:
 * - Needs expressed as INVITATIONS, never accusations (see lib/pet-needs.ts)
 * - Cute meters (paws/hearts), not clinical bars
 * - The egg stage is alive: wobbles, glows, invites taps
 * - Works for all three pet tracks (real photo, virtual, shelter buddy)
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assertNoGuilt,
  celebrateMission,
  currentSignal,
  feedPet,
  happinessFrom,
  loadNeeds,
  needLevel,
  playWithPet,
  saveNeeds,
  setSleeping,
  tapPet,
  welcomeBackLine,
  type NeedKind,
  type PetNeedsState,
} from "../../lib/pet-needs";
import { PetBuddyFace, type PetKind } from "./pet-buddy";

const NEED_META: Record<NeedKind | "happiness", { icon: string; label: string; hint: string }> = {
  hunger: { icon: "🍎", label: "Tummy", hint: "Feed Jack a snack to fill this up!" },
  attention: { icon: "💛", label: "Playtime", hint: "Tap Jack or do a mission together!" },
  energy: { icon: "😴", label: "Energy", hint: "Tuck Jack in for a nap to recharge!" },
  happiness: { icon: "✨", label: "Happy", hint: "Grows when Jack's other needs are met!" },
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
  // 5 paws; filled count from value
  const filled = Math.round((value / 100) * 5);
  return (
    <button
      onClick={onTap}
      aria-label={`${meta.label}: ${level}. ${meta.hint}`}
      className={`flex flex-col items-center rounded-2xl px-2 py-1.5 transition-all ${
        highlighted ? "bg-[#ffd166]/40 ring-2 ring-[#ffd166] scale-105" : "hover:bg-white/60"
      }`}
    >
      <span className="text-lg" aria-hidden="true">{meta.icon}</span>
      <span className="mt-0.5 flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`text-[10px] ${i < filled ? "" : "opacity-25 grayscale"}`}>
            🐾
          </span>
        ))}
      </span>
      <span className="mt-0.5 text-[10px] font-black text-[#4f625b]">{meta.label}</span>
    </button>
  );
}

const FOODS = ["🍎", "🍖", "🥕", "🫐", "🧀"];

/** Illustrated egg that wobbles, glows, and invites interaction. */
function LivingEgg({
  needsGlow,
  onTap,
  tapWiggleKey,
}: {
  needsGlow: boolean;
  onTap: () => void;
  tapWiggleKey: number;
}) {
  return (
    <button
      onClick={onTap}
      aria-label="Tap Jack's egg to say hi"
      className="relative grid size-28 place-items-center sm:size-32"
      style={{ animation: tapWiggleKey > 0 ? `pet-tap-wiggle 0.5s ease-out, pet-egg-wobble 3.2s ease-in-out 0.5s infinite` : `pet-egg-wobble 3.2s ease-in-out infinite` }}
      key={tapWiggleKey}
    >
      {/* warm glow when needs are met */}
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
        {/* sleepy eyes on the egg — it's alive! */}
        <circle cx="38" cy="62" r="3.5" fill="#4f625b" />
        <circle cx="62" cy="62" r="3.5" fill="#4f625b" />
        <circle cx="39.5" cy="60.5" r="1.2" fill="#fff" />
        <circle cx="63.5" cy="60.5" r="1.2" fill="#fff" />
        <path d="M44 74 Q50 78 56 74" stroke="#4f625b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* rosy cheeks */}
        <ellipse cx="30" cy="70" rx="5" ry="3.5" fill="#ffb3a7" opacity="0.7" />
        <ellipse cx="70" cy="70" rx="5" ry="3.5" fill="#ffb3a7" opacity="0.7" />
      </svg>
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

  const signal = useMemo(() => (needs ? currentSignal(needs) : null), [needs]);
  const happiness = useMemo(() => (needs ? happinessFrom(needs) : 0), [needs]);
  const needsGlow = useMemo(() => (needs ? happinessFrom(needs) >= 60 : false), [needs]);

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

  const handlePlay = useCallback(() => {
    update((s) => playWithPet(s));
    setTapWiggleKey((k) => k + 1);
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
    signalLine = "Jack is here with you 💛";
  }

  const values: Record<NeedKind | "happiness", number> = {
    hunger: needs.hunger,
    attention: needs.attention,
    energy: needs.energy,
    happiness,
  };

  return (
    <div className={`overflow-hidden rounded-3xl border border-[#ded8c7] bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
      {/* Welcome back — warm, never guilt */}
      {showWelcome && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-[#ffd166]/25 px-3 py-2">
          <p className="text-sm font-extrabold text-[#17231f]">{welcomeBackLine(hoursAway)}</p>
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
        {/* Jack himself — tappable! */}
        <div className="relative shrink-0">
          {isEgg ? (
            <LivingEgg needsGlow={needsGlow} onTap={handleTapPet} tapWiggleKey={tapWiggleKey} />
          ) : (
            <button onClick={handleTapPet} aria-label={`Tap ${petName} to say hi`} className="relative block">
              <div
                className={`size-28 sm:size-32 ${needs.sleeping ? "pet-sleepy" : ""}`}
                style={needs.sleeping ? undefined : { animation: "pet-egg-wobble 3.2s ease-in-out infinite" }}
              >
                <PetBuddyFace kind={petKind} photoUrl={photoUrl} label={petName} size="lg" className="!size-full" />
              </div>
              {/* need-expression overlays */}
              {signal.kind === "hungry" && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xl" style={{ animation: "reward-pop 1.6s ease-in-out infinite" }} aria-hidden="true">
                  🍽️
                </span>
              )}
              {signal.kind === "wantsPlay" && (
                <span className="absolute -top-2 -right-1 text-xl" style={{ animation: "pet-excited 1.2s ease-in-out infinite" }} aria-hidden="true">
                  👋
                </span>
              )}
              {needs.sleeping && (
                <span className="zzz-float absolute -right-1 top-0 text-xl" aria-hidden="true">💤</span>
              )}
              {signal.kind === "happy" && !needs.sleeping && (
                <span className="absolute -top-1 -left-1 text-base" style={{ animation: "reward-pop 2s ease-in-out infinite" }} aria-hidden="true">
                  ✨
                </span>
              )}
              {justFed && (
                <span className="absolute inset-0 grid place-items-center text-4xl" style={{ animation: "reward-pop 1.8s ease-out forwards" }} aria-hidden="true">
                  {justFed}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Signal + action */}
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-[#17231f]">{signalLine}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {signal.kind === "hungry" ? (
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
            ) : signal.kind === "wantsPlay" || signal.kind === "needsLove" ? (
              <button onClick={handlePlay} className="tt-btn-press rounded-2xl bg-[#ffd166] px-4 py-2 text-sm font-black text-[#17231f]">
                {signal.actionLabel} 💛
              </button>
            ) : signal.kind === "sleepy" ? (
              <button onClick={handleSleepToggle} className="tt-btn-press rounded-2xl bg-[#1e3a8a] px-4 py-2 text-sm font-black text-white">
                {signal.actionLabel} 😴
              </button>
            ) : signal.kind === "resting" ? (
              <button onClick={handleSleepToggle} className="tt-btn-press rounded-2xl bg-[#ffd166] px-4 py-2 text-sm font-black text-[#17231f]">
                {signal.actionLabel} ☀️
              </button>
            ) : (
              <button onClick={handleTapPet} className="tt-btn-press rounded-2xl bg-[#e8f5e0] px-4 py-2 text-sm font-black text-[#17231f]">
                {signal.actionLabel} 👋
              </button>
            )}
            {!needs.sleeping && signal.kind !== "sleepy" && (
              <button
                onClick={handleSleepToggle}
                className="rounded-2xl px-3 py-2 text-xs font-black text-[#4f625b] ring-1 ring-[#ded8c7]"
                aria-label="Tuck Jack in for a nap"
              >
                😴 Nap
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cute needs meters */}
      <div className="mt-3 grid grid-cols-4 gap-1 border-t border-[#f0ece0] pt-3">
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
          {NEED_META[hintNeed].icon} {NEED_META[hintNeed].hint}
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
