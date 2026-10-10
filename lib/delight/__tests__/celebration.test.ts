/**
 * Tests for the celebration engine + delight layer.
 *
 * Covers: sound module safety (no-ops without window), pet mood logic,
 * evolution mood prop, brave-try detection wiring, and the celebration
 * reward builder contract.
 */
import { describe, expect, it, vi } from "vitest";
import { evolutionStageFor, nextEvolutionStage } from "../../../app/components/PetEvolution";
import { braveTriesFromMissions } from "../../../app/components/BraveTryStreak";
import type { Mission } from "../../../lib/types";

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    title: "Test mission",
    category: "chore",
    difficulty: "easy",
    points: 10,
    coins: 2,
    question: "Did you do it?",
    status: "pending",
    ...overrides,
  } as Mission;
}

describe("evolution stages (delight layer)", () => {
  it("starts at egg", () => {
    expect(evolutionStageFor(0).stage).toBe("egg");
  });
  it("hatches at 5 missions", () => {
    expect(evolutionStageFor(5).stage).toBe("baby");
    expect(evolutionStageFor(4).stage).toBe("egg");
  });
  it("reaches wise at 60", () => {
    expect(evolutionStageFor(60).stage).toBe("wise");
    expect(nextEvolutionStage(60)).toBeNull();
  });
  it("reports next stage correctly", () => {
    expect(nextEvolutionStage(0)?.stage).toBe("baby");
    expect(nextEvolutionStage(14)?.stage).toBe("junior");
  });
});

describe("brave-try detection for mini-celebration routing", () => {
  it("flags hard missions the kid engaged with", () => {
    const ms = [mission({ difficulty: "hard", completedBy: "kid-1" })];
    expect(braveTriesFromMissions(ms, "kid-1")).toHaveLength(1);
  });
  it("flags super_hard missions with just a note (attempted)", () => {
    const ms = [mission({ difficulty: "super_hard", note: "tried my best" })];
    const tries = braveTriesFromMissions(ms);
    expect(tries).toHaveLength(1);
    expect(tries[0].outcome).toBe("attempted");
  });
  it("ignores easy missions", () => {
    const ms = [mission({ difficulty: "easy", completedBy: "kid-1" })];
    expect(braveTriesFromMissions(ms, "kid-1")).toHaveLength(0);
  });
  it("ignores hard missions with zero engagement", () => {
    const ms = [mission({ difficulty: "hard" })];
    expect(braveTriesFromMissions(ms)).toHaveLength(0);
  });
});

describe("sound module (SSR-safe)", () => {
  it("exports all delight sounds without throwing outside a browser", async () => {
    const sound = await import("../../../lib/sound");
    expect(typeof sound.playChime).toBe("function");
    expect(typeof sound.playStarBurst).toBe("function");
    expect(typeof sound.playPop).toBe("function");
    expect(typeof sound.playBraveTry).toBe("function");
    expect(typeof sound.playFanfare).toBe("function");
    expect(typeof sound.playWelcomeBack).toBe("function");
    expect(typeof sound.playClick).toBe("function");
    expect(typeof sound.playBoop).toBe("function");
    // Must not throw when window is undefined (SSR / vitest node env)
    expect(() => sound.playChime()).not.toThrow();
    expect(() => sound.playFanfare()).not.toThrow();
  });
  it("mute toggle functions exist", async () => {
    const sound = await import("../../../lib/sound");
    expect(typeof sound.setSoundMuted).toBe("function");
    expect(typeof sound.getSoundMuted).toBe("function");
  });
});

describe("celebration reward contract", () => {
  it("trait rewards carry icon + title + detail", async () => {
    const { TRAIT_META } = await import("../../../lib/character-curriculum");
    for (const key of Object.keys(TRAIT_META) as (keyof typeof TRAIT_META)[]) {
      const meta = TRAIT_META[key];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.emoji.length).toBeGreaterThan(0);
      expect(meta.blurb.length).toBeGreaterThan(0);
    }
  });
});

describe("pet mood classification (no guilt states)", () => {
  it("mood union contains only warm states", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/components/PetReactions.tsx", "utf8");
    for (const banned of ["disappointed", "angry", "ashamed", "guilt"]) {
      expect(src.toLowerCase().includes(`"${banned}"`)).toBe(false);
    }
    expect(src).toContain("encourage");
  });
});
