import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MISSION_CATEGORIES,
  MISSION_DIFFICULTIES,
  MISSION_SKILLS,
  THRIVER_TRAITS,
  SKILL_TO_TRAITS,
  buildChildSnapshot,
  buildMissionEventRow,
  buildMissionSetMessages,
  buildMissionSetSystemPrompt,
  calibrateDifficulty,
  computeBehavioralTraitSignals,
  computeTraitWeights,
  emitMissionEvent,
  fetchMissionSet,
  loadCachedMissionSet,
  lowestWeightedTrait,
  PARENT_VOICE_GUIDELINES,
  parseMissionSetResponse,  planMissionSlots,
  redactSnapshotForModel,
  saveCachedMissionSet,
  scanMissionsForBlockedContent,
  topWeightedTrait,
  traitScoresFromSkillPoints,
  validateMissionSetInput,
  type ChildSnapshot,
  type GeneratedMission,
  type SnapshotCompletionInput,
} from "../mission-engine";

const CHILD_ID = "123e4567-e89b-12d3-a456-426614174000";

function daysAgoIso(days: number, base: number): string {
  return new Date(base - days * 86_400_000).toISOString();
}

function makeSnapshot(overrides: Partial<ChildSnapshot> = {}): ChildSnapshot {
  const base: ChildSnapshot = {
    ageBand: "7-9",
    age: 8,
    skillPoints14d: { responsibility: 4, empathy: 1, teamwork: 0, leadership: 2, time: 3 },
    skillPoints30d: { responsibility: 8, empathy: 2, teamwork: 1, leadership: 4, time: 6 },
    traitScores: traitScoresFromSkillPoints({ responsibility: 8, empathy: 2, teamwork: 1, leadership: 4, time: 6 }),
    traitWeights: {
      confidence: 0.15,
      empathy: 0.14,
      "self-control": 0.12,
      integrity: 0.11,
      curiosity: 0.16,
      perseverance: 0.09,
      optimism: 0.23,
    },
    weakestTraits: ["optimism", "curiosity"],
    weakestSkill: "teamwork",
    strongestSkill: "responsibility",
    completionRate14d: 0.71,
    completionRateByWeekday: { 0: null, 1: 0.8, 2: 0.75, 3: 0.7, 4: 0.3, 5: 0.8, 6: 0.9 },
    weakWeekdays: [4],
    completionRateByCategory: { pet_care: 0.9, chore: 0.6 },
    weakCategories: [],
    completionRateByDifficulty: { easy: 0.9, medium: 0.6 },
    daysSinceCompletion: 1,
    currentStreak: 6,
    assigned14d: 14,
    skipRejectRate14d: 0.07,
    calibratedDifficulty: { pet_care: "medium", chore: "easy", kindness: "easy" },
    pets: [{ species: "guinea pig" }, { species: "tortoise" }],
  };
  return { ...base, ...overrides };
}

describe("traitScoresFromSkillPoints", () => {
  it("normalizes trait scores to 0..1", () => {
    const scores = traitScoresFromSkillPoints({
      responsibility: 10,
      empathy: 5,
      teamwork: 0,
      leadership: 0,
      time: 0,
    });
    expect(scores.integrity).toBe(1);
    expect(scores["self-control"]).toBe(1);
    expect(scores.empathy).toBe(0.5);
    expect(scores.optimism).toBe(0.5); // empathy also develops optimism
    expect(scores.curiosity).toBe(0); // nothing maps here with these inputs
    for (const trait of THRIVER_TRAITS) {
      expect(scores[trait]).toBeGreaterThanOrEqual(0);
      expect(scores[trait]).toBeLessThanOrEqual(1);
    }
  });

  it("covers all seven traits as keys", () => {
    const scores = traitScoresFromSkillPoints({
      responsibility: 1,
      empathy: 1,
      teamwork: 1,
      leadership: 1,
      time: 1,
    });
    expect(Object.keys(scores).sort()).toEqual([...THRIVER_TRAITS].sort());
  });
});

describe("computeTraitWeights", () => {
  const evenScores = {
    confidence: 0.5,
    empathy: 0.5,
    "self-control": 0.5,
    integrity: 0.5,
    curiosity: 0.5,
    perseverance: 0.5,
    optimism: 0.5,
  };

  it("sums to 1.0 and respects the variety guard bounds", () => {
    const weights = computeTraitWeights(evenScores, "7-9");
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 2);
    for (const trait of THRIVER_TRAITS) {
      expect(weights[trait]).toBeGreaterThanOrEqual(0.05);
      expect(weights[trait]).toBeLessThanOrEqual(0.35);
    }
  });

  it("is deficit-driven: the lowest-scoring trait gets the highest weight", () => {
    const weights = computeTraitWeights({ ...evenScores, optimism: 0.1 }, "7-9");
    expect(topWeightedTrait(weights)).toBe("optimism");
  });

  it("is deterministic: same inputs give identical weights", () => {
    const a = computeTraitWeights(evenScores, "4-6");
    const b = computeTraitWeights(evenScores, "4-6");
    expect(a).toEqual(b);
  });

  it("differs by age band: developmental priorities shift the emphasis", () => {
    const young = computeTraitWeights(evenScores, "4-6");
    const old = computeTraitWeights(evenScores, "10-12");
    // Integrity is top priority at 10-12 but bottom at 4-6.
    expect(old.integrity).toBeGreaterThan(young.integrity);
  });

  it("applies the multiplier boost: a strong trait scaffolds its weak partner", () => {
    const scores = { ...evenScores, confidence: 0.8, perseverance: 0.3 };
    const boosted = computeTraitWeights(scores, "7-9");
    const baseline = computeTraitWeights({ ...evenScores, confidence: 0.5, perseverance: 0.3 }, "7-9");
    expect(boosted.perseverance).toBeGreaterThan(baseline.perseverance);
  });

  it("does not boost when both partners are strong", () => {
    const scores = { ...evenScores, confidence: 0.8, perseverance: 0.8 };
    const weights = computeTraitWeights(scores, "7-9");
    // Both strong -> low deficit -> below-average weight for both.
    const avg = 1 / 7;
    expect(weights.confidence).toBeLessThan(avg);
    expect(weights.perseverance).toBeLessThan(avg);
  });

  it("cold-start neutral scores still produce a valid distribution", () => {
    const weights = computeTraitWeights(evenScores, "7-9");
    expect(topWeightedTrait(weights)).toBe("empathy"); // top age-prior at 7-9
    expect(lowestWeightedTrait(weights)).toBe("optimism"); // bottom age-prior at 7-9
  });
});

describe("computeBehavioralTraitSignals", () => {
  const thin: Parameters<typeof computeBehavioralTraitSignals>[0] = {
    difficultySelection: {},
    categoryCompletionCounts: {},
    approvalRate30d: null,
    skipRejectRate14d: null,
    completionRate14d: null,
    hardCompletionRate30d: null,
    currentStreak: 0,
    daysSinceCompletion: null,
  };

  it("falls back to neutral when data is too thin", () => {
    const signals = computeBehavioralTraitSignals(thin);
    for (const trait of THRIVER_TRAITS) {
      expect(signals[trait]).toBe(0.5);
    }
  });

  it("reads confidence from difficulty selection", () => {
    const signals = computeBehavioralTraitSignals({
      ...thin,
      difficultySelection: { easy: 1, medium: 3, hard: 1 },
    });
    expect(signals.confidence).toBeCloseTo(0.8, 5);
  });

  it("reads empathy from prosocial mission selection", () => {
    const signals = computeBehavioralTraitSignals({
      ...thin,
      categoryCompletionCounts: { kindness: 3, pet_care: 1, chore: 1 },
    });
    expect(signals.empathy).toBeCloseTo(0.8, 5);
  });

  it("reads integrity from the parent approval rate", () => {
    const signals = computeBehavioralTraitSignals({ ...thin, approvalRate30d: 0.9 });
    expect(signals.integrity).toBe(0.9);
  });

  it("keeps every signal in 0..1", () => {
    const signals = computeBehavioralTraitSignals({
      ...thin,
      difficultySelection: { hard: 10 },
      categoryCompletionCounts: { kindness: 10, pet_care: 10, chore: 10, money: 10, community: 10 },
      approvalRate30d: 1,
      skipRejectRate14d: 0,
      completionRate14d: 1,
      hardCompletionRate30d: 1,
      currentStreak: 60,
      daysSinceCompletion: 0,
    });
    for (const trait of THRIVER_TRAITS) {
      expect(signals[trait]).toBeGreaterThanOrEqual(0);
      expect(signals[trait]).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildChildSnapshot", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");

  it("aggregates skill points over 14 and 30 day windows", () => {
    const snapshot = buildChildSnapshot({
      child: { age: 8, streakDays: 3, lastStreakDate: "2026-10-07" },
      completions: [],
      awards: [
        { skill: "empathy", awardedAt: daysAgoIso(2, now) },
        { skill: "empathy", awardedAt: daysAgoIso(20, now) },
        { skill: "empathy", awardedAt: daysAgoIso(60, now) },
      ],
      pets: [],
      now,
    });
    expect(snapshot.skillPoints14d.empathy).toBe(1);
    expect(snapshot.skillPoints30d.empathy).toBe(2);
  });

  it("produces trait scores and weights that sum to 1.0", () => {
    const snapshot = buildChildSnapshot({
      child: { age: 8, streakDays: 3, lastStreakDate: "2026-10-07" },
      completions: [
        { category: "pet_care", difficulty: "medium", status: "approved", completedAt: daysAgoIso(2, now) },
        { category: "kindness", difficulty: "easy", status: "approved", completedAt: daysAgoIso(3, now) },
        { category: "chore", difficulty: "easy", status: "approved", completedAt: daysAgoIso(5, now) },
        { category: "chore", difficulty: "hard", status: "approved", completedAt: daysAgoIso(6, now) },
      ],
      awards: [{ skill: "responsibility", awardedAt: daysAgoIso(2, now) }],
      pets: [],
      now,
    });
    const total = Object.values(snapshot.traitWeights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 2);
    for (const trait of THRIVER_TRAITS) {
      expect(snapshot.traitScores[trait]).toBeGreaterThanOrEqual(0);
      expect(snapshot.traitScores[trait]).toBeLessThanOrEqual(1);
    }
    expect(snapshot.weakestTraits).toHaveLength(2);
  });

  it("derives the age band from the child age", () => {
    const young = buildChildSnapshot({
      child: { age: 5, streakDays: 0, lastStreakDate: null },
      completions: [],
      awards: [],
      pets: [],
      now,
    });
    expect(young.ageBand).toBe("4-6");
    const old = buildChildSnapshot({
      child: { age: 11, streakDays: 0, lastStreakDate: null },
      completions: [],
      awards: [],
      pets: [],
      now,
    });
    expect(old.ageBand).toBe("10-12");
  });

  it("computes daysSinceCompletion from the latest approval", () => {
    const snapshot = buildChildSnapshot({
      child: { age: 8, streakDays: 2, lastStreakDate: null },
      completions: [
        { completedAt: daysAgoIso(2, now), status: "approved", category: "chore", difficulty: "easy", skill: "time" },
        { completedAt: daysAgoIso(5, now), status: "approved", category: "chore", difficulty: "easy", skill: "time" },
      ],
      awards: [],
      pets: [],
      now,
    });
    expect(snapshot.daysSinceCompletion).toBe(2);
  });

  it("returns null completion rate with too few samples", () => {
    const snapshot = buildChildSnapshot({
      child: { age: 8, streakDays: 0, lastStreakDate: null },
      completions: [
        { completedAt: daysAgoIso(1, now), status: "approved", category: "chore", difficulty: "easy", skill: "time" },
      ],
      awards: [],
      pets: [],
      now,
    });
    expect(snapshot.completionRate14d).toBeNull();
  });

  it("never includes child PII in the snapshot", () => {
    const snapshot = buildChildSnapshot({
      child: { age: 8, streakDays: 1, lastStreakDate: null },
      completions: [],
      awards: [],
      pets: [{ species: "Guinea Pig" }],
      now,
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(/Maya|Leo|test-child/i);
    expect(snapshot.pets).toEqual([{ species: "Guinea Pig" }]);
  });
});

describe("redactSnapshotForModel", () => {
  it("keeps only coarse aggregates", () => {
    const redacted = redactSnapshotForModel(makeSnapshot());
    expect(redacted.ageBand).toBe("7-9");
    expect(redacted.traitFocus).toEqual(["optimism", "curiosity"]);
    expect(redacted.weakWeekdays).toEqual(["Thursday"]);
    expect(redacted.pets).toEqual([{ species: "guinea pig" }, { species: "tortoise" }]);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("traitScores");
    expect(serialized).not.toContain("strongestSkill");
  });
});

describe("planMissionSlots", () => {
  it("opens with a regulation-first slot when engagement dropped off", () => {
    const plan = planMissionSlots(makeSnapshot({ daysSinceCompletion: 5, completionRate14d: 0.3, assigned14d: 10 }));
    expect(plan.slots[0].kind).toBe("regulation_first");
    expect(plan.slots[0].difficulty).toBe("easy");
    expect(plan.rationale).toMatch(/regulation_first/);
  });

  it("opens with a trait-entry slot for an engaged child", () => {
    const plan = planMissionSlots(makeSnapshot());
    expect(plan.slots[0].kind).toBe("trait_entry");
    expect(plan.slots[0].traitFocus).toBe("optimism");
  });

  it("targets the top-weighted trait (not just the weakest score) for the entry slot", () => {
    const snapshot = makeSnapshot({
      traitWeights: {
        confidence: 0.1,
        empathy: 0.1,
        "self-control": 0.1,
        integrity: 0.1,
        curiosity: 0.4,
        perseverance: 0.1,
        optimism: 0.1,
      },
    });
    const plan = planMissionSlots(snapshot);
    expect(plan.slots[0].kind).toBe("trait_entry");
    expect(plan.slots[0].traitFocus).toBe("curiosity");
  });

  it("adds a wildcard slot when requested, placed before the confidence anchor", () => {
    const plan = planMissionSlots(makeSnapshot(), { count: 5, wildcard: true });
    const wildcard = plan.slots.find((s) => s.kind === "wildcard");
    expect(wildcard).toBeDefined();
    expect(plan.slots[plan.slots.length - 1].kind).toBe("confidence_anchor");
    expect(plan.rationale).toMatch(/wildcard/);
  });

  it("adds no wildcard slot by default", () => {
    const plan = planMissionSlots(makeSnapshot(), { count: 5 });
    expect(plan.slots.some((s) => s.kind === "wildcard")).toBe(false);
  });

  it("honors the parent focus skill when unused", () => {
    const plan = planMissionSlots(makeSnapshot(), { count: 4, focusSkill: "leadership" });
    const focusSlot = plan.slots.find((s) => s.kind === "parent_focus");
    expect(focusSlot?.skill).toBe("leadership");
  });

  it("ends with a confidence anchor", () => {
    const plan = planMissionSlots(makeSnapshot(), { count: 4 });
    expect(plan.slots[plan.slots.length - 1].kind).toBe("confidence_anchor");
  });

  it("never exceeds the calibrated difficulty band", () => {
    const plan = planMissionSlots(
      makeSnapshot({ calibratedDifficulty: { pet_care: "easy", chore: "easy", kindness: "easy", money: "easy", community: "easy" } }),
      { count: 6 },
    );
    for (const slot of plan.slots) {
      expect(MISSION_DIFFICULTIES.indexOf(slot.difficulty)).toBeLessThanOrEqual(0);
    }
  });

  it("clamps count to 3..6", () => {
    expect(planMissionSlots(makeSnapshot(), { count: 10 }).slots).toHaveLength(6);
    expect(planMissionSlots(makeSnapshot(), { count: 1 }).slots).toHaveLength(3);
  });
});

describe("validateMissionSetInput", () => {
  it("accepts a valid request", () => {
    const result = validateMissionSetInput({ childId: CHILD_ID, count: 4, focusSkill: "empathy" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.childId).toBe(CHILD_ID);
      expect(result.value.count).toBe(4);
    }
  });

  it("defaults count to 4", () => {
    const result = validateMissionSetInput({ childId: CHILD_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.count).toBe(4);
  });

  it("rejects a non-UUID childId", () => {
    const result = validateMissionSetInput({ childId: "not-a-uuid" });
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range counts", () => {
    expect(validateMissionSetInput({ childId: CHILD_ID, count: 2 }).ok).toBe(false);
    expect(validateMissionSetInput({ childId: CHILD_ID, count: 7 }).ok).toBe(false);
  });

  it("rejects unknown focus skills", () => {
    const result = validateMissionSetInput({ childId: CHILD_ID, focusSkill: "flying" });
    expect(result.ok).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validateMissionSetInput(null).ok).toBe(false);
    expect(validateMissionSetInput("x").ok).toBe(false);
  });
});

describe("buildMissionSetMessages", () => {
  it("embeds slot constraints and the trait focus", () => {
    const snapshot = makeSnapshot();
    const redacted = redactSnapshotForModel(snapshot);
    const plan = planMissionSlots(snapshot, { count: 3 });
    const messages = buildMissionSetMessages(redacted, plan);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toMatch(/Slot 1/);
    expect(messages[1].content).toMatch(/optimism/);
    expect(messages[0].content).toMatch(/PARENTS/);
  });

  it("never includes a child name in the prompt", () => {
    const redacted = redactSnapshotForModel(makeSnapshot());
    const plan = planMissionSlots(makeSnapshot(), { count: 3 });
    const text = JSON.stringify(buildMissionSetMessages(redacted, plan));
    expect(text).not.toMatch(/Maya|Leo/);
  });

  it("includes the weighted trait emphasis line, highest first", () => {
    const redacted = redactSnapshotForModel(makeSnapshot());
    const plan = planMissionSlots(makeSnapshot(), { count: 3 });
    const messages = buildMissionSetMessages(redacted, plan);
    const userText = messages[1].content;
    expect(userText).toMatch(/Trait emphasis \(weighted\):/);
    const line = userText.split("\n").find((l) => l.startsWith("Trait emphasis"));
    expect(line).toBeDefined();
    // optimism has the highest weight in the fixture (0.23) -> listed first
    expect(line!.indexOf("optimism")).toBeLessThan(line!.indexOf("perseverance"));
  });
});

describe("parseMissionSetResponse", () => {
  const valid = JSON.stringify([
    { title: "Slow grooming session", detail: "Gentle brushing for 5 slow minutes.", skill: "empathy", category: "pet_care", difficulty: "easy", points: 10, minutes: 5, petLinked: true },
    { title: "Room reset", detail: "Bed made, desk cleared.", skill: "responsibility", category: "chore", difficulty: "easy", points: 8, minutes: 10, petLinked: false },
  ]);

  it("parses a valid mission array", () => {
    const missions = parseMissionSetResponse(valid);
    expect(missions).toHaveLength(2);
    expect(missions?.[0].title).toBe("Slow grooming session");
    expect(missions?.[0].petLinked).toBe(true);
  });

  it("salvages JSON wrapped in prose", () => {
    const missions = parseMissionSetResponse(`Here you go:\n${valid}\nEnjoy!`);
    expect(missions).toHaveLength(2);
  });

  it("rejects unknown skills and categories", () => {
    const bad = JSON.stringify([
      { title: "X", detail: "Y", skill: "flying", category: "pet_care", difficulty: "easy", points: 10, minutes: 5, petLinked: false },
      { title: "Z", detail: "W", skill: "empathy", category: "space", difficulty: "easy", points: 10, minutes: 5, petLinked: false },
    ]);
    expect(parseMissionSetResponse(bad)).toBeNull();
  });

  it("clamps points and minutes", () => {
    const extreme = JSON.stringify([
      { title: "A", detail: "B", skill: "time", category: "chore", difficulty: "hard", points: 999, minutes: 999, petLinked: false },
      { title: "C", detail: "D", skill: "time", category: "chore", difficulty: "easy", points: 1, minutes: 0, petLinked: false },
    ]);
    const missions = parseMissionSetResponse(extreme);
    expect(missions?.[0].points).toBe(25);
    expect(missions?.[0].minutes).toBe(15);
    expect(missions?.[1].points).toBe(5);
    expect(missions?.[1].minutes).toBe(1);
  });

  it("requires at least two missions", () => {
    const one = JSON.stringify([
      { title: "A", detail: "B", skill: "time", category: "chore", difficulty: "easy", points: 8, minutes: 5, petLinked: false },
    ]);
    expect(parseMissionSetResponse(one)).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseMissionSetResponse("not json at all")).toBeNull();
    expect(parseMissionSetResponse("{}")).toBeNull();
  });
});

describe("scanMissionsForBlockedContent", () => {
  const clean: GeneratedMission = {
    title: "Slow grooming session", detail: "Gentle brushing.", skill: "empathy",
    category: "pet_care", difficulty: "easy", points: 8, minutes: 5, petLinked: true, traitFocus: null,
  };

  it("passes clean missions", () => {
    expect(scanMissionsForBlockedContent([clean])).toBeNull();
  });

  it("flags clinical and harmful content", () => {
    const bad = { ...clean, detail: "Talk about your anxiety disorder." };
    expect(scanMissionsForBlockedContent([bad])).toBe("Slow grooming session");
    const worse = { ...clean, title: "Knife skills practice" };
    expect(scanMissionsForBlockedContent([worse])).toBe("Knife skills practice");
  });
});


describe("calibrateDifficulty", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  function rows(rate: number, n: number, category: "chore" = "chore"): SnapshotCompletionInput[] {
    const out: SnapshotCompletionInput[] = [];
    const approved = Math.round(rate * n);
    for (let i = 0; i < n; i++) {
      out.push({
        completedAt: daysAgoIso(i % 28, now),
        status: i < approved ? "approved" : "rejected",
        category,
        difficulty: "easy",
        skill: "time",
      });
    }
    return out;
  }

  it("steps up when the child breezes through", () => {
    const cal = calibrateDifficulty(rows(0.95, 20), "7-9", now);
    expect(cal.chore).toBe("medium");
  });

  it("steps down when struggling", () => {
    const cal = calibrateDifficulty(rows(0.2, 20), "10-12", now);
    expect(cal.chore).toBe("easy");
  });

  it("uses the age default with too few samples", () => {
    const cal = calibrateDifficulty(rows(1, 3), "10-12", now);
    expect(cal.chore).toBe("medium");
  });
});

describe("mission-set cache", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("round-trips a cached set per child", () => {
    expect(loadCachedMissionSet(CHILD_ID)).toBeNull();
    saveCachedMissionSet({
      childId: CHILD_ID,
      savedAt: new Date().toISOString(),
      missions: [],
      mode: "ai",
    });
    expect(loadCachedMissionSet(CHILD_ID)?.mode).toBe("ai");
    expect(loadCachedMissionSet("other-child")).toBeNull();
  });
});

describe("fetchMissionSet", () => {
  it("returns ok:false without a token", async () => {
    const result = await fetchMissionSet({ token: "", childId: CHILD_ID });
    expect(result.ok).toBe(false);
  });

  it("parses a successful AI response", async () => {
    const missions = [
      { title: "Slow grooming session", detail: "Gentle brushing.", skill: "empathy", category: "pet_care", difficulty: "easy", points: 10, minutes: 5, petLinked: true },
      { title: "Room reset", detail: "Tidy up.", skill: "responsibility", category: "chore", difficulty: "easy", points: 8, minutes: 10, petLinked: false },
    ];
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ missions, generationId: "gen-1" }), { status: 200 }),
    );
    const result = await fetchMissionSet({ fetchFn: fetchFn as typeof fetch, token: "tok", childId: CHILD_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe("ai");
      expect(result.missions).toHaveLength(2);
      expect(result.generationId).toBe("gen-1");
    }
  });

  it("fails closed on blocked content", async () => {
    const missions = [
      { title: "Talk about your anxiety", detail: "Discuss your disorder.", skill: "empathy", category: "kindness", difficulty: "easy", points: 8, minutes: 5, petLinked: false },
      { title: "Room reset", detail: "Tidy up.", skill: "responsibility", category: "chore", difficulty: "easy", points: 8, minutes: 10, petLinked: false },
    ];
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ missions, generationId: "gen-1" }), { status: 200 }),
    );
    const result = await fetchMissionSet({ fetchFn: fetchFn as typeof fetch, token: "tok", childId: CHILD_ID });
    expect(result.ok).toBe(false);
  });

  it("fails closed on network errors", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("down"));
    const result = await fetchMissionSet({ fetchFn: fetchFn as typeof fetch, token: "tok", childId: CHILD_ID });
    expect(result.ok).toBe(false);
  });
});

describe("mission events", () => {
  it("stamps weekday and hour at write time", () => {
    const row = buildMissionEventRow(
      { familyId: "f1", childId: "c1", eventType: "completed", category: "chore" },
      Date.parse("2026-10-08T12:00:00Z"), // a Thursday
    );
    expect(row.weekday).toBe(4);
    expect(row.hourOfDay).toBe(12);
    expect(row.createdAt).toBe("2026-10-08T12:00:00.000Z");
  });

  it("emitMissionEvent returns false when the sink throws", async () => {
    const ok = await emitMissionEvent(
      { insertMissionEvent: async () => { throw new Error("db down"); } },
      { familyId: "f1", childId: "c1", eventType: "skipped" },
    );
    expect(ok).toBe(false);
  });

  it("emitMissionEvent returns true on success", async () => {
    const ok = await emitMissionEvent(
      { insertMissionEvent: async () => ({ ok: true }) },
      { familyId: "f1", childId: "c1", eventType: "approved" },
    );
    expect(ok).toBe(true);
  });
});

describe("system prompt guardrails", () => {
  it("declares parent-only audience and prohibitions", () => {
    const prompt = buildMissionSetSystemPrompt();
    expect(prompt).toMatch(/PARENTS/);
    expect(prompt).toMatch(/Never medical/);
    expect(prompt).toMatch(/JSON array/);
  });

  it("uses no trademarked program names", () => {
    const prompt = buildMissionSetSystemPrompt();
    expect(prompt).not.toMatch(/Neurosequential/i);
    expect(prompt).not.toMatch(/Somatic Experiencing/i);
  });

  it("carries the conscious-parenting voice: companionship, joy, no shaming", () => {
    const prompt = buildMissionSetSystemPrompt();
    expect(prompt).toMatch(/WITH the child, side by side, as a companion/);
    expect(prompt).toMatch(/Celebrate joy and brave tries/);
    expect(prompt).toMatch(/Never shame the parent/);
    expect(prompt).toMatch(/never what's wrong with the child/);
    expect(prompt).not.toMatch(/lazy|disobedient|bad parent/i);
  });
});

describe("PARENT_VOICE_GUIDELINES", () => {
  it("covers all four conscious-parenting principles", () => {
    expect(PARENT_VOICE_GUIDELINES).toMatch(/they can shift/i);
    expect(PARENT_VOICE_GUIDELINES).toMatch(/companion, not a supervisor/);
    expect(PARENT_VOICE_GUIDELINES).toMatch(/brave tries/);
    expect(PARENT_VOICE_GUIDELINES).toMatch(/no shaming/i);
  });
});
