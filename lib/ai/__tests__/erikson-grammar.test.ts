import { describe, expect, it } from "vitest";
import {
  ANTI_COMPARISON_RULES,
  GRAMMAR_DESIGN_RULES,
  STAGE_GRAMMARS,
  grammarInstructionFor,
  selectStageGrammar,
  type StageGrammar,
} from "../erikson-grammar";
import {
  buildChildSnapshot,
  buildMissionSetUserMessage,
  planMissionSlots,
  redactSnapshotForModel,
} from "../mission-engine";

describe("selectStageGrammar", () => {
  it("gives initiative to young children (band 4-6)", () => {
    expect(selectStageGrammar(4, "4-6", false)).toBe("initiative");
    expect(selectStageGrammar(null, "4-6", false)).toBe("initiative");
  });

  it("gives blend to the 5-6 overlap window", () => {
    expect(selectStageGrammar(5, "4-6", false)).toBe("blend");
    expect(selectStageGrammar(6, "4-6", false)).toBe("blend");
  });

  it("gives industry to older children", () => {
    expect(selectStageGrammar(7, "7-9", false)).toBe("industry");
    expect(selectStageGrammar(9, "7-9", false)).toBe("industry");
    expect(selectStageGrammar(10, "10-12", false)).toBe("industry");
    expect(selectStageGrammar(12, "10-12", false)).toBe("industry");
    expect(selectStageGrammar(null, "7-9", false)).toBe("industry");
  });

  it("regresses to initiative under stress, regardless of age — unlabeled", () => {
    expect(selectStageGrammar(10, "10-12", true)).toBe("initiative");
    expect(selectStageGrammar(7, "7-9", true)).toBe("initiative");
    expect(selectStageGrammar(5, "4-6", true)).toBe("initiative");
  });

  it("only produces the three known grammars", () => {
    expect(STAGE_GRAMMARS).toEqual(["initiative", "industry", "blend"]);
  });
});

describe("grammar design rules", () => {
  it("initiative grammar has no fail state and the child leads", () => {
    const rules = GRAMMAR_DESIGN_RULES.initiative;
    expect(rules).toMatch(/no fail state/i);
    expect(rules).toMatch(/child direct|you lead/i);
    expect(rules).toMatch(/audience/i);
  });

  it("industry grammar has mastery ladders, free retry, and process praise", () => {
    const rules = GRAMMAR_DESIGN_RULES.industry;
    expect(rules).toMatch(/mastery/i);
    expect(rules).toMatch(/free retry/i);
    expect(rules).toMatch(/process-focused praise/i);
  });

  it("blend grammar starts open-ended and scaffolds to one outcome", () => {
    const rules = GRAMMAR_DESIGN_RULES.blend;
    expect(rules).toMatch(/open-ended/i);
    expect(rules).toMatch(/one completable outcome/i);
  });

  it("every grammar carries the anti-comparison rules", () => {
    for (const grammar of STAGE_GRAMMARS as readonly StageGrammar[]) {
      const block = grammarInstructionFor(grammar);
      expect(block).toContain(ANTI_COMPARISON_RULES);
      expect(block).toMatch(/no ranking/i);
      expect(block).toMatch(/leaderboard/i);
    }
  });

  it("contains no clinical or trademarked language", () => {
    const all = Object.values(GRAMMAR_DESIGN_RULES).join("\n") + ANTI_COMPARISON_RULES;
    expect(all).not.toMatch(/trauma|dysregulat|diagnos|therap|somatic experiencing|neurosequential/i);
  });
});

describe("planMissionSlots grammar integration", () => {
  function snapshotFor(age: number | null, extra: Record<string, unknown> = {}) {
    return buildChildSnapshot({
      child: { age, streakDays: 5, lastStreakDate: null },
      completions: [],
      awards: [],
      pets: [],
      now: Date.parse("2026-10-08T12:00:00Z"),
      ...extra,
    });
  }

  it("selects blend for a 5-year-old", () => {
    const plan = planMissionSlots(snapshotFor(5));
    expect(plan.grammar).toBe("blend");
    expect(plan.rationale).toMatch(/grammar: blend/);
  });

  it("selects industry for a 9-year-old", () => {
    const plan = planMissionSlots(snapshotFor(9));
    expect(plan.grammar).toBe("industry");
  });

  it("selects initiative for a 4-year-old", () => {
    const plan = planMissionSlots(snapshotFor(4));
    expect(plan.grammar).toBe("initiative");
  });

  it("regresses to initiative on a real disengagement pattern", () => {
    const now = Date.parse("2026-10-08T12:00:00Z");
    const day = 86_400_000;
    const completions = Array.from({ length: 6 }, (_, i) => ({
      completedAt: new Date(now - (4 + i) * day).toISOString(),
      status: "rejected" as const,
      category: "chore" as const,
      difficulty: "easy",
    }));
    const snapshot = buildChildSnapshot({
      child: { age: 11, streakDays: 0, lastStreakDate: null },
      completions,
      awards: [],
      pets: [],
      now,
    });
    const plan = planMissionSlots(snapshot);
    expect(plan.grammar).toBe("initiative");
    // The rationale is internal/machine-readable — no stress labels leak.
    expect(plan.rationale).not.toMatch(/stress|anxiet|trauma/i);
  });
});

describe("buildMissionSetUserMessage grammar integration", () => {
  it("includes the grammar instruction block matching the plan grammar", () => {
    const snapshot = buildChildSnapshot({
      child: { age: 6, streakDays: 3, lastStreakDate: null },
      completions: [],
      awards: [],
      pets: [],
      now: Date.parse("2026-10-08T12:00:00Z"),
    });
    const plan = planMissionSlots(snapshot);
    expect(plan.grammar).toBe("blend");
    const redacted = redactSnapshotForModel(snapshot);
    const message = buildMissionSetUserMessage(redacted, plan);
    expect(message).toContain("Developmental framing");
    expect(message).toContain(grammarInstructionFor("blend"));
    expect(message).toContain(ANTI_COMPARISON_RULES);
  });

  it("never leaks grammar selection as a child label", () => {
    const snapshot = buildChildSnapshot({
      child: { age: 9, streakDays: 2, lastStreakDate: null },
      completions: [],
      awards: [],
      pets: [],
      now: Date.parse("2026-10-08T12:00:00Z"),
    });
    const plan = planMissionSlots(snapshot);
    const message = buildMissionSetUserMessage(redactSnapshotForModel(snapshot), plan);
    expect(message).not.toMatch(/stressed|disengaged|regress/i);
  });
});
