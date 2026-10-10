import { describe, expect, it } from "vitest";
import {
  SEED_SCENARIOS,
  branchingComplexity,
  buildChoiceScenarioPrompt,
  decisionGrowthCopy,
  detectDecisionPattern,
  parseChoiceScenarioResponse,
  scanScenarioForJudgment,
  seedScenarioById,
  seedScenariosFor,
  validateScenarioText,
  type ChoiceEvent,
} from "../choice-adventures";

describe("seedScenariosFor", () => {
  it("returns scenarios per age mode (incl. respect + patience seeds)", () => {
    expect(seedScenariosFor("sprout")).toHaveLength(4);
    expect(seedScenariosFor("grow")).toHaveLength(4);
    expect(seedScenariosFor("thrive")).toHaveLength(2);
  });
  it("includes respect dilemma seeds", () => {
    const ids = SEED_SCENARIOS.map((s) => s.id);
    expect(ids).toContain("seed-sprout-game");
    expect(ids).toContain("seed-grow-borrow");
  });
  it("includes patience tradeoff seeds", () => {
    const ids = SEED_SCENARIOS.map((s) => s.id);
    expect(ids).toContain("seed-sprout-cookie");
    expect(ids).toContain("seed-grow-seeds");
  });
  it("sprout scenarios have exactly 2 choices", () => {
    for (const s of seedScenariosFor("sprout")) {
      expect(s.choices).toHaveLength(2);
      expect(s.outcomes).toHaveLength(2);
    }
  });
  it("every choice has a matching outcome", () => {
    for (const s of SEED_SCENARIOS) {
      const ids = new Set(s.choices.map((c) => c.id));
      for (const o of s.outcomes) {
        expect(ids.has(o.choiceId)).toBe(true);
      }
    }
  });
  it("seedScenarioById finds by id", () => {
    expect(seedScenarioById("seed-sprout-crayon")?.title).toBe("The Red Crayon");
    expect(seedScenarioById("nope")).toBeUndefined();
  });
});

describe("branchingComplexity", () => {
  it("sprout gets 2 simple choices", () => {
    expect(branchingComplexity("sprout")).toEqual({ choiceCount: 2, depth: "simple" });
  });
  it("grow gets 2 normally, 3 when thriving", () => {
    expect(branchingComplexity("grow")).toEqual({ choiceCount: 2, depth: "simple" });
    expect(branchingComplexity("grow", 1400)).toEqual({ choiceCount: 3, depth: "simple" });
  });
  it("thrive gets 3 tradeoff choices", () => {
    expect(branchingComplexity("thrive")).toEqual({ choiceCount: 3, depth: "tradeoff" });
  });
});

function makeEvents(n: number, opts: Partial<ChoiceEvent> = {}): ChoiceEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    scenarioId: `s${i}`,
    choiceId: `c${i}`,
    choiceArchetype: "playful",
    decisionTimeMs: 8000,
    rewound: false,
    pathsExplored: 1,
    atMs: Date.now() - i * 1000,
    ...opts,
  }));
}

describe("detectDecisionPattern", () => {
  it("returns null with too few events", () => {
    expect(detectDecisionPattern(makeEvents(4))).toBeNull();
  });
  it("detects exploration from rewind behavior", () => {
    expect(detectDecisionPattern(makeEvents(6, { rewound: true, pathsExplored: 2 }))).toBe("exploration");
  });
  it("detects deliberation from slow decisions", () => {
    expect(detectDecisionPattern(makeEvents(6, { decisionTimeMs: 20000 }))).toBe("deliberation");
  });
  it("detects impulsivity from fast, never-rewound decisions", () => {
    expect(detectDecisionPattern(makeEvents(6, { decisionTimeMs: 2000, rewound: false }))).toBe("impulsivity");
  });
  it("detects people_pleasing from kind archetype dominance", () => {
    expect(detectDecisionPattern(makeEvents(6, { choiceArchetype: "kind", decisionTimeMs: 9000 }))).toBe(
      "people_pleasing"
    );
  });
  it("detects avoidance from careful archetype dominance", () => {
    expect(detectDecisionPattern(makeEvents(6, { choiceArchetype: "careful", decisionTimeMs: 9000 }))).toBe(
      "avoidance"
    );
  });
  it("returns null for balanced play", () => {
    const events = [
      ...makeEvents(2, { choiceArchetype: "bold" }),
      ...makeEvents(2, { choiceArchetype: "kind" }),
      ...makeEvents(2, { choiceArchetype: "careful" }),
    ];
    expect(detectDecisionPattern(events)).toBeNull();
  });
});

describe("decisionGrowthCopy", () => {
  it("handles zero adventures warmly", () => {
    const copy = decisionGrowthCopy("Maya", 0, 0, null);
    expect(copy).toContain("Maya");
    expect(copy).not.toContain("0 endings");
  });
  it("celebrates explored endings", () => {
    const copy = decisionGrowthCopy("Leo", 2, 4, "exploration");
    expect(copy).toContain("4 different endings");
    expect(copy).toContain("what if");
  });
  it("never uses labels like impulsive or bad", () => {
    for (const p of ["impulsivity", "people_pleasing", "avoidance", "deliberation", "exploration"] as const) {
      const copy = decisionGrowthCopy("Ava", 3, 5, p).toLowerCase();
      expect(copy).not.toContain("impulsive");
      expect(copy).not.toContain("bad choice");
      expect(copy).not.toContain("wrong");
    }
  });
});

describe("buildChoiceScenarioPrompt", () => {
  it("builds system + user without PII", () => {
    const { system, user } = buildChoiceScenarioPrompt({
      ageMode: "grow",
      choiceCount: 3,
      depth: "simple",
      traitBands: { confidence: "growing", empathy: "blooming" },
    });
    expect(system).toContain("NO right or wrong choices");
    expect(system).toContain("STRICT JSON");
    expect(user).toContain("grow");
    expect(user).toContain("confidence");
    // no scores, no names
    expect(user).not.toMatch(/\d\.\d{2}/);
  });
  it("mentions recent titles to avoid repeats", () => {
    const { user } = buildChoiceScenarioPrompt({
      ageMode: "sprout",
      choiceCount: 2,
      depth: "simple",
      traitBands: {},
      recentTitles: ["The Red Crayon"],
    });
    expect(user).toContain("The Red Crayon");
  });
});

describe("parseChoiceScenarioResponse", () => {
  const valid = {
    title: "Test",
    emoji: "🧪",
    setup: "A test scenario.",
    choices: [
      { id: "a", label: "Do A", emoji: "🅰️", archetype: "bold" },
      { id: "b", label: "Do B", emoji: "🅱️", archetype: "kind" },
    ],
    outcomes: [
      { choiceId: "a", headline: "A happened", story: "Story A.", emoji: "✨", feeling: "happy" },
      { choiceId: "b", headline: "B happened", story: "Story B.", emoji: "🌟", feeling: "okay" },
    ],
  };
  it("parses a valid response", () => {
    const s = parseChoiceScenarioResponse(valid, "grow", "test-1");
    expect(s?.title).toBe("Test");
    expect(s?.choices).toHaveLength(2);
    expect(s?.ageMode).toBe("grow");
  });
  it("rejects mismatched outcomes", () => {
    const bad = { ...valid, outcomes: [valid.outcomes[0]] };
    expect(parseChoiceScenarioResponse(bad, "grow", "x")).toBeNull();
  });
  it("rejects non-objects", () => {
    expect(parseChoiceScenarioResponse(null, "grow", "x")).toBeNull();
    expect(parseChoiceScenarioResponse("nope", "grow", "x")).toBeNull();
  });
  it("normalizes unknown archetypes", () => {
    const weird = {
      ...valid,
      choices: [{ id: "a", label: "A", archetype: "weird" }, { id: "b", label: "B" }],
    };
    const s = parseChoiceScenarioResponse(weird, "sprout", "x");
    expect(s?.choices[0].archetype).toBe("playful");
  });
});

describe("scanScenarioForJudgment", () => {
  it("flags judgmental phrases", () => {
    expect(scanScenarioForJudgment("That was the wrong choice")).toBe("wrong choice");
    expect(scanScenarioForJudgment("You should have shared")).toBe("you should have");
  });
  it("passes clean text", () => {
    expect(scanScenarioForJudgment("Sam smiles and you keep coloring.")).toBeNull();
  });
});

describe("validateScenarioText", () => {
  it("passes all seed scenarios", () => {
    for (const s of SEED_SCENARIOS) {
      expect(validateScenarioText(s)).toEqual([]);
    }
  });
});
