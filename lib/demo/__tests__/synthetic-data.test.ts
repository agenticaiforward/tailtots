import { describe, expect, it } from "vitest";
import {
  generateDemoFamily,
  toCopilotEvents,
  toFlourishEvents,
  toFlowEvents,
  toSnapshotAwards,
  toSnapshotCompletions,
  seededRandom,
} from "../synthetic-data";
import { buildChildSnapshot } from "../../ai/mission-engine";
import { detectPatterns } from "../../ai/copilot";

const NOW = Date.parse("2026-10-09T12:00:00Z");

describe("seededRandom", () => {
  it("is deterministic", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("differs by seed", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe("generateDemoFamily", () => {
  it("generates 3 children, 2 pets, 90 days of history", () => {
    const fam = generateDemoFamily(NOW, 90);
    expect(fam.children).toHaveLength(3);
    expect(fam.pets).toHaveLength(2);
    expect(fam.daysOfHistory).toBe(90);
    expect(fam.missions.length).toBeGreaterThan(300);
    expect(fam.badges.length).toBeGreaterThan(100);
  });

  it("is deterministic across runs", () => {
    const a = generateDemoFamily(NOW, 90);
    const b = generateDemoFamily(NOW, 90);
    expect(a.missions.length).toBe(b.missions.length);
    expect(a.missions[0].taskId).toBe(b.missions[0].taskId);
    expect(a.badges.length).toBe(b.badges.length);
  });

  it("plants Maya's Thursday weakness (detectable by the real detector)", () => {
    const fam = generateDemoFamily(NOW, 90);
    const events = toCopilotEvents(fam.missions.filter((m) => m.childId === "demo-maya"));
    const patterns = detectPatterns(events, { streakDays: 3, age: 5 }, NOW);
    const thu = patterns.find((p) => p.insightType === "weak_weekday");
    expect(thu).toBeDefined();
    expect(thu!.detail.weekdayName).toBe("Thursday");
  });

  it("every mission has a valid lifecycle", () => {
    const fam = generateDemoFamily(NOW, 30);
    for (const m of fam.missions) {
      // Exactly one terminal state
      const terminals = [m.completedAt !== null, m.skipped, m.expired].filter(Boolean).length;
      expect(terminals).toBe(1);
      // Completed implies started
      if (m.completedAt) expect(m.startedAt).not.toBeNull();
      // Approved implies completed
      if (m.approvedAt) expect(m.completedAt).not.toBeNull();
    }
  });
});

describe("adapters produce valid algorithm inputs", () => {
  it("snapshot inputs build a valid ChildSnapshot", () => {
    const fam = generateDemoFamily(NOW, 90);
    const child = fam.children[0];
    const missions = fam.missions.filter((m) => m.childId === child.id);
    const snapshot = buildChildSnapshot({
      child: { age: child.age, streakDays: child.streakDays, lastStreakDate: child.lastStreakDate },
      completions: toSnapshotCompletions(missions),
      awards: toSnapshotAwards(fam.badges.filter((b) => b.childId === child.id)),
      pets: fam.pets.map((p) => ({ species: p.species, name: p.name, careNeeds: p.careNeeds })),
    });
    expect(snapshot.traitScores.confidence).toBeGreaterThanOrEqual(0);
    expect(snapshot.traitScores.confidence).toBeLessThanOrEqual(1);
    const weightSum = Object.values(snapshot.traitWeights).reduce((a, b) => a + b, 0);
    expect(weightSum).toBeCloseTo(1.0, 2);
  });

  it("flourish and flow adapters produce non-empty inputs", () => {
    const fam = generateDemoFamily(NOW, 90);
    const missions = fam.missions.filter((m) => m.childId === "demo-ava");
    expect(toFlourishEvents(missions).length).toBeGreaterThan(0);
    expect(toFlowEvents("demo-ava", missions).length).toBeGreaterThan(0);
  });
});
