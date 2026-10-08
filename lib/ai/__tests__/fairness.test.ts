import { describe, expect, it, vi } from "vitest";
import type { Child, Mission } from "../../types";
import {
  analyzeFairness,
  buildFairnessCoachingSystemPrompt,
  buildFairnessCoachingUserMessage,
  FAIRNESS_BALANCED_SPREAD,
  fairnessCoachFallback,
  fairnessCoachingPayload,
  fairnessMissionSkill,
  fetchFairnessCoaching,
  validateFairnessCoachingInput,
} from "../fairness";

function makeChild(id: string, name: string, age: number): Child {
  return { id, name, age, secretCode: "", points: 0, coins: 0, level: "easy", streakDays: 0 };
}

function makeMission(overrides: Partial<Mission> & { id: string; title: string }): Mission {
  return {
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 2,
    question: "q",
    status: "pending",
    ...overrides,
  };
}

describe("fairnessMissionSkill", () => {
  it("maps categories to trackable skills", () => {
    expect(fairnessMissionSkill(makeMission({ id: "a", title: "a", category: "kindness" }))).toBe("empathy");
    expect(fairnessMissionSkill(makeMission({ id: "b", title: "b", category: "community" }))).toBe("teamwork");
    expect(fairnessMissionSkill(makeMission({ id: "c", title: "c", category: "money" }))).toBe("leadership");
    expect(fairnessMissionSkill(makeMission({ id: "d", title: "d", category: "chore" }))).toBe("time");
    expect(fairnessMissionSkill(makeMission({ id: "e", title: "e", category: "pet_care" }))).toBe("responsibility");
  });
});

describe("analyzeFairness", () => {
  it("reports balanced when the spread is within the rule", () => {
    const kids = [makeChild("k1", "Maya", 6), makeChild("k2", "Leo", 9)];
    const missions = [
      makeMission({ id: "m1", title: "Feed", assignedChildId: "k1", points: 10 }),
      makeMission({ id: "m2", title: "Walk", assignedChildId: "k2", points: 16 }),
    ];
    const analysis = analyzeFairness(missions, kids);
    expect(analysis.spread).toBe(6);
    expect(analysis.balanced).toBe(true);
    expect(analysis.moves).toEqual([]);
    expect(analysis.kids).toHaveLength(2);
    expect(analysis.kids[0].avgDifficulty).toBe(1);
  });

  it("proposes a concrete move from the heaviest to the lightest kid", () => {
    const kids = [makeChild("k1", "Maya", 6), makeChild("k2", "Leo", 9)];
    const missions = [
      makeMission({ id: "m1", title: "Big job", assignedChildId: "k1", points: 30, difficulty: "easy" }),
      makeMission({ id: "m2", title: "Small job", assignedChildId: "k2", points: 10 }),
    ];
    const analysis = analyzeFairness(missions, kids);
    expect(analysis.spread).toBe(20);
    expect(analysis.balanced).toBe(false);
    expect(analysis.moves.length).toBeGreaterThan(0);
    const move = analysis.moves[0];
    expect(move.fromChildId).toBe("k1");
    expect(move.toChildId).toBe("k2");
    expect(move.missionId).toBe("m1");
    expect(move.reason.length).toBeGreaterThan(0);
  });

  it("never moves completed or approved missions", () => {
    const kids = [makeChild("k1", "Maya", 9), makeChild("k2", "Leo", 9)];
    const missions = [
      makeMission({ id: "m1", title: "Done job", assignedChildId: "k1", points: 30, completedBy: "k1" }),
      makeMission({ id: "m2", title: "Old job", assignedChildId: "k1", points: 30, status: "approved", completedBy: "k1" }),
    ];
    const analysis = analyzeFairness(missions, kids);
    expect(analysis.moves).toEqual([]);
    expect(analysis.insight).toContain("no open");
  });

  it("respects age-fit: hard missions do not move to young kids", () => {
    const kids = [makeChild("k1", "Maya", 12), makeChild("k2", "Leo", 5)];
    const missions = [
      makeMission({ id: "m1", title: "Hard job", assignedChildId: "k1", points: 40, difficulty: "hard" }),
    ];
    const analysis = analyzeFairness(missions, kids);
    expect(analysis.moves).toEqual([]);
  });

  it("chains moves until the spread is within the rule", () => {
    const kids = [makeChild("k1", "Maya", 9), makeChild("k2", "Leo", 9)];
    const missions = [
      makeMission({ id: "m1", title: "Job one", assignedChildId: "k1", points: 20 }),
      makeMission({ id: "m2", title: "Job two", assignedChildId: "k1", points: 20 }),
      makeMission({ id: "m3", title: "Job three", assignedChildId: "k1", points: 20 }),
    ];
    const analysis = analyzeFairness(missions, kids);
    expect(analysis.spread).toBe(60);
    expect(analysis.moves.length).toBeLessThanOrEqual(3);
    // Simulate applying the moves: spread must shrink.
    let remaining = 60;
    for (const move of analysis.moves) remaining -= 2 * move.points;
    expect(remaining).toBeLessThanOrEqual(FAIRNESS_BALANCED_SPREAD);
  });

  it("handles a single kid gracefully", () => {
    const analysis = analyzeFairness([], [makeChild("k1", "Maya", 6)]);
    expect(analysis.spread).toBe(0);
    expect(analysis.moves).toEqual([]);
    expect(analysis.insight).toContain("second kid");
  });
});

describe("fairnessCoachFallback", () => {
  it("produces an honest templated tip from real analysis", () => {
    const kids = [makeChild("k1", "Maya", 6), makeChild("k2", "Leo", 9)];
    const analysis = analyzeFairness(
      [makeMission({ id: "m1", title: "Big job", assignedChildId: "k1", points: 30 })],
      kids,
    );
    const tip = fairnessCoachFallback(analysis);
    expect(tip).toContain("Big job");
    expect(tip).toContain("Maya");
    expect(tip).toContain("Leo");
  });
});

describe("fairnessCoachingPayload", () => {
  it("anonymizes kids: no names or ids leave the device", () => {
    const analysis = analyzeFairness(
      [makeMission({ id: "m1", title: "x", assignedChildId: "k1", points: 10 })],
      [makeChild("k1", "Maya", 6)],
    );
    const payload = fairnessCoachingPayload(analysis);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("Maya");
    expect(serialized).not.toContain("k1");
    expect(payload.perKid[0].ageBand).toBe("4-6");
  });
});

describe("validateFairnessCoachingInput", () => {
  it("accepts a valid anonymized payload", () => {
    const result = validateFairnessCoachingInput({
      spread: 12,
      balanced: false,
      perKid: [{ ageBand: "7-9", plannedPoints: 30, openCount: 2, avgDifficulty: 1.5, topSkill: "time" }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects bad shapes", () => {
    expect(validateFairnessCoachingInput(null).ok).toBe(false);
    expect(validateFairnessCoachingInput({ spread: -1, balanced: true, perKid: [] }).ok).toBe(false);
    expect(
      validateFairnessCoachingInput({
        spread: 5,
        balanced: true,
        perKid: [{ ageBand: "xx", plannedPoints: 1, openCount: 1, avgDifficulty: 1, topSkill: "time" }],
      }).ok,
    ).toBe(false);
  });
});

describe("coaching message builders", () => {
  it("builds an anonymized coaching prompt", () => {
    const analysis = analyzeFairness(
      [makeMission({ id: "m1", title: "x", assignedChildId: "k1", points: 10 })],
      [makeChild("k1", "Maya", 6), makeChild("k2", "Leo", 9)],
    );
    const payload = fairnessCoachingPayload(analysis);
    const message = buildFairnessCoachingUserMessage(payload);
    expect(message).not.toContain("Maya");
    expect(message).toContain("Kid 1");
    expect(buildFairnessCoachingSystemPrompt()).toContain("60 words");
  });
});

describe("fetchFairnessCoaching", () => {
  it("returns ok:false without a token", async () => {
    const analysis = analyzeFairness([], [makeChild("k1", "Maya", 6)]);
    expect(await fetchFairnessCoaching({ token: "", analysis })).toEqual({ ok: false });
  });

  it("posts anonymized aggregates and returns the tip", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ tip: "Try swapping one task." }), { status: 200 }));
    const analysis = analyzeFairness([], [makeChild("k1", "Maya", 6)]);
    const result = await fetchFairnessCoaching({
      fetchFn: fetchFn as typeof fetch,
      token: "tok",
      analysis,
    });
    expect(result).toEqual({ ok: true, tip: "Try swapping one task." });
    const callArgs = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(JSON.stringify(body)).not.toContain("Maya");
  });

  it("returns ok:false when the endpoint fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("down");
    });
    const analysis = analyzeFairness([], [makeChild("k1", "Maya", 6)]);
    const result = await fetchFairnessCoaching({
      fetchFn: fetchFn as typeof fetch,
      token: "tok",
      analysis,
    });
    expect(result).toEqual({ ok: false });
  });
});
