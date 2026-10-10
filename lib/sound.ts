/**
 * sound — tiny Web Audio synth for kid-delight feedback. No audio files.
 *
 * All sounds are synthesized with oscillators + gain envelopes, so the app
 * ships zero audio assets and works offline. Sounds are short (20–120ms for
 * micro-feedback, up to 2s for milestone fanfares) per the design research
 * timing cheat-sheet.
 *
 * Respects a persisted mute preference (localStorage) and never autoplays —
 * the AudioContext is created lazily on the first user gesture, which also
 * satisfies browser autoplay policies.
 */

"use client";

const MUTE_KEY = "tailtots:sound-muted";

let ctx: AudioContext | null = null;
let muted = false;

function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  if (!muted) {
    try {
      muted = window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* storage unavailable — stay unmuted default */
    }
  }
  return muted;
}

export function setSoundMuted(m: boolean): void {
  muted = m;
  try {
    window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getSoundMuted(): boolean {
  return isMuted();
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || isMuted()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; vol?: number };

function playNotes(notes: Note[]): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  for (const n of notes) {
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = n.type ?? "sine";
      osc.frequency.value = n.freq;
      const vol = n.vol ?? 0.18;
      const start = t0 + n.at;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.05);
    } catch {
      /* one bad note shouldn't kill the sequence */
    }
  }
}

/** Gentle UI tap — 40ms blip. */
export function playClick(): void {
  playNotes([{ freq: 660, at: 0, dur: 0.06, type: "sine", vol: 0.08 }]);
}

/** Mission complete chime — warm two-note ascending (C5 → G5). */
export function playChime(): void {
  playNotes([
    { freq: 523.25, at: 0, dur: 0.18, type: "sine", vol: 0.16 },
    { freq: 783.99, at: 0.12, dur: 0.28, type: "sine", vol: 0.16 },
  ]);
}

/** Star burst — quick sparkle arpeggio (C6 E6 G6). */
export function playStarBurst(): void {
  playNotes([
    { freq: 1046.5, at: 0, dur: 0.12, type: "triangle", vol: 0.12 },
    { freq: 1318.5, at: 0.07, dur: 0.12, type: "triangle", vol: 0.12 },
    { freq: 1568.0, at: 0.14, dur: 0.2, type: "triangle", vol: 0.12 },
  ]);
}

/** Reward card pop — soft pop per card. */
export function playPop(): void {
  playNotes([{ freq: 880, at: 0, dur: 0.09, type: "sine", vol: 0.12 }]);
}

/** Brave Try mini-celebration — encouraging, distinct from completion. */
export function playBraveTry(): void {
  playNotes([
    { freq: 392.0, at: 0, dur: 0.15, type: "sine", vol: 0.14 },
    { freq: 523.25, at: 0.1, dur: 0.15, type: "sine", vol: 0.14 },
    { freq: 659.25, at: 0.2, dur: 0.25, type: "sine", vol: 0.14 },
  ]);
}

/** Milestone fanfare — evolution / graduation (reserved, ~1.5s). */
export function playFanfare(): void {
  playNotes([
    { freq: 523.25, at: 0, dur: 0.16, type: "triangle", vol: 0.16 },
    { freq: 523.25, at: 0.16, dur: 0.16, type: "triangle", vol: 0.16 },
    { freq: 523.25, at: 0.32, dur: 0.16, type: "triangle", vol: 0.16 },
    { freq: 659.25, at: 0.48, dur: 0.32, type: "triangle", vol: 0.16 },
    { freq: 783.99, at: 0.8, dur: 0.5, type: "triangle", vol: 0.18 },
  ]);
}

/** Welcome-back melody — warm, unhurried. */
export function playWelcomeBack(): void {
  playNotes([
    { freq: 440, at: 0, dur: 0.2, type: "sine", vol: 0.12 },
    { freq: 554.37, at: 0.18, dur: 0.2, type: "sine", vol: 0.12 },
    { freq: 659.25, at: 0.36, dur: 0.35, type: "sine", vol: 0.12 },
  ]);
}

/** Soft "boop" for a miss / gentle retry — funny, never harsh. No buzzer, ever. */
export function playBoop(): void {
  playNotes([{ freq: 330, at: 0, dur: 0.1, type: "sine", vol: 0.1 }]);
}
