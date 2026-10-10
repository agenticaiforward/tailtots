/**
 * AlivePet — the "alive" wrapper that makes any pet feel like a friend.
 *
 * VIRTUAL pets (illustrated/emoji, no photo):
 *   - Idle: breathing (subtle scale pulse), occasional blink, ear wiggles
 *   - Reactions: jump-for-joy, spin, sway, bounce-toward
 *   - Micro: follows cursor slightly, happy wiggle + boop on tap
 *
 * REAL pet photos:
 *   - Ken Burns (slow zoom/pan) so static photos feel alive
 *   - Playful bobbing frame
 *   - Celebration: happy bounce + confetti burst around the photo
 *   - Idle: gentle dim + floating "Zzz" (sleeping state)
 *
 * The pet is NEVER fully still — there's always subtle life.
 * All animations are transform/opacity only (60fps, GPU-friendly) and
 * respect prefers-reduced-motion (static fallback).
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PetBuddyFace, type PetKind } from "./pet-buddy";

export type PetMood = "idle" | "celebrate" | "excited" | "sleepy" | "encourage" | "curious";

interface AlivePetProps {
  /** Real photo URL — when present, the photo is the hero. */
  photoUrl?: string;
  petName: string;
  petKind: PetKind;
  mood?: PetMood;
  size?: "sm" | "md" | "lg";
  /** When true, the photo does the celebration bounce. */
  celebrating?: boolean;
  /** Tap handler for the micro-interaction (wiggle + callback). */
  onTap?: () => void;
  /** Disable cursor-follow (e.g. inside scroll containers). */
  noFollow?: boolean;
}

const SIZES = {
  sm: "size-20",
  md: "size-28",
  lg: "size-40",
} as const;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

export default function AlivePet({
  photoUrl,
  petName,
  petKind,
  mood = "idle",
  size = "md",
  celebrating = false,
  onTap,
  noFollow = false,
}: AlivePetProps) {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tapped, setTapped] = useState(false);
  const [blink, setBlink] = useState(false);
  const [lean, setLean] = useState({ x: 0, y: 0 });

  /* Occasional blink for virtual pets (no photo). */
  useEffect(() => {
    if (reduced || photoUrl) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => alive && setBlink(false), 180);
        schedule();
      }, 2800 + Math.random() * 3200);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reduced, photoUrl]);

  /* Subtle cursor follow — the pet notices you. */
  useEffect(() => {
    if (reduced || noFollow) return;
    const el = wrapRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
      setLean({ x: dx * 6, y: dy * 4 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, noFollow]);

  const handleTap = useCallback(() => {
    if (reduced) {
      onTap?.();
      return;
    }
    setTapped(true);
    setTimeout(() => setTapped(false), 600);
    onTap?.();
  }, [onTap, reduced]);

  const effectiveMood = celebrating ? "celebrate" : mood;
  const anim = reduced ? "" : animationFor(effectiveMood, !!photoUrl);

  return (
    <div
      ref={wrapRef}
      className={`relative inline-block ${SIZES[size]} ${onTap && !reduced ? "cursor-pointer" : ""}`}
      role="img"
      aria-label={`${petName}, feeling ${effectiveMood}`}
      onClick={onTap ? handleTap : undefined}
      style={
        reduced || noFollow
          ? undefined
          : { transform: `translate(${lean.x}px, ${lean.y}px)`, transition: "transform 0.4s ease-out" }
      }
    >
      {/* Breathing wrapper — always alive, even at rest */}
      <div className={reduced ? "" : "animate-pet-breathe"} style={{ transformOrigin: "50% 80%" }}>
        {/* Mood / tap animation layer */}
        <div className={`${anim} ${tapped && !reduced ? "animate-pet-tap-wiggle" : ""}`}>
          {photoUrl ? (
            <RealPhotoFace
              photoUrl={photoUrl}
              petName={petName}
              petKind={petKind}
              mood={effectiveMood}
              reduced={reduced}
              size={size}
            />
          ) : (
            <div className="relative h-full w-full">
              <PetBuddyFace kind={petKind} label={petName} size={size === "lg" ? "lg" : "md"} animated={!reduced} />
              {blink && (
                <div
                  className="pointer-events-none absolute inset-x-[28%] top-[38%] flex justify-between"
                  aria-hidden="true"
                >
                  <div className="h-[3px] w-[12%] rounded-full bg-[#17231f]" />
                  <div className="h-[3px] w-[12%] rounded-full bg-[#17231f]" />
                </div>
              )}
              {!reduced && effectiveMood === "curious" && (
                <div className="absolute -right-1 top-0 animate-pet-head-tilt text-xl" aria-hidden="true">
                  ❓
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sleeping Zzz */}
      {!reduced && effectiveMood === "sleepy" && (
        <div className="pointer-events-none absolute -right-2 -top-1" aria-hidden="true">
          <span className="animate-zzz-float inline-block text-lg">💤</span>
        </div>
      )}

      {/* Celebration confetti burst around the photo/face */}
      {!reduced && effectiveMood === "celebrate" && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {["⭐", "🎉", "💛", "🐾", "✨", "🌟"].map((e, i) => (
            <span
              key={i}
              className="animate-celeb-burst absolute text-lg"
              style={{
                left: "50%",
                top: "50%",
                animationDelay: `${i * 0.06}s`,
                ["--burst-angle" as string]: `${i * 60}deg`,
              }}
            >
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function animationFor(mood: PetMood, isPhoto: boolean): string {
  switch (mood) {
    case "celebrate":
      return "animate-pet-jump-joy";
    case "excited":
      return "animate-pet-spin-happy";
    case "sleepy":
      return isPhoto ? "animate-photo-sleep" : "animate-pet-sway-sleepy";
    case "encourage":
      return "animate-pet-bounce-gentle";
    case "curious":
      return "animate-pet-head-tilt";
    case "idle":
    default:
      return isPhoto ? "animate-frame-bob" : "";
  }
}

/** Real photo as the hero — PetBuddyFace already composites species
 *  accessories (ears, tails) around the photo without covering the face.
 *  We add Ken Burns life + mood states on top. */
function RealPhotoFace({
  photoUrl,
  petName,
  petKind,
  mood,
  reduced,
  size,
}: {
  photoUrl: string;
  petName: string;
  petKind: PetKind;
  mood: PetMood;
  reduced: boolean;
  size: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={`relative h-full w-full ${reduced ? "" : "animate-ken-burns-frame"} ${
        mood === "sleepy" && !reduced ? "animate-photo-sleep-dim" : ""
      }`}
    >
      <PetBuddyFace kind={petKind} photoUrl={photoUrl} label={petName} size={size === "lg" ? "lg" : "md"} animated={false} />
    </div>
  );
}

/** Compact inline version for mission cards, headers, chips. */
export function AlivePetChip({
  photoUrl,
  petName,
  petKind,
  mood = "idle",
}: Pick<AlivePetProps, "photoUrl" | "petName" | "petKind" | "mood">) {
  return (
    <span className="inline-flex items-center gap-2">
      <AlivePet photoUrl={photoUrl} petName={petName} petKind={petKind} mood={mood} size="sm" noFollow />
      <span className="tt-body text-sm font-black text-tt-navy">{petName}</span>
    </span>
  );
}
