import { describe, it, expect } from "vitest";
import {
  classifyEngineState,
  buildObservations,
  buildBodyToolkit,
  buildGrowthPlan,
  assembleBlueprint,
  buildBlueprintSystemPrompt,
  buildBlueprintUserPrompt,
  blueprintFallbackNarrative,
  sanitizeBlueprintNarration,
  validateBlueprintInput,
  type BlueprintAssemblyInput,
  type EngineStateInput,
} from "../blueprint";
import { FLOURISH_PILLARS, type FlourishScores } from "../flourishing";

const baseEngine: EngineStateInput = {
  completionRate14d: 0.7,
  avgMinutesPerMission: 8,
  skipRate14d: 0.1,
  recentCompletions: 5,
  hardAttempts14d: 2,
  hardCompletions14d: 1,
};

const baseScores: FlourishScores = {
  joy: 70,
  stick: 55,
  together: 80,
  giving: 45,
  mastery: 60,
};

function baseInput(over: Partial<BlueprintAssemblyInput> = {}): BlueprintAssemblyInput {
  return {
    childId: "child-1",
    age: 8,
    engine: { ...baseEngine },
    traitScores: { confidence: 0.6, perseverance: 0.4 },
    weakestTraits: ["perseverance", "self-control"],
    flourishScores: { ...baseScores },
    hasPet: true,
    parentFocusSkill: null,
    ...over,
  };
}

describe("classifyEngineState", () => {
  it("classifies steady patterns as cruising", () => {
    expect(classifyEngineState(baseEngine)).toBe("cruising");
  });

  it("classifies revving-without-traction as running_hot", () => {
    expect(
      classifyEngineState({
        ...baseEngine,
        completionRate14d: 0.3,
        hardAttempts14d: 5,
        hardCompletions14d: 1,
      }),
    ).toBe("running_hot");
  });

  it("classifies rushing as running_hot", () => {
    expect(
      classifyEngineState({
        ...baseEngine,
        avgMinutesPerMission: 1,
        recentCompletions: 6,
      }),
    ).toBe("running_hot");
  });

  it("classifies quiet stretches as stalled", () => {
    expect(
      classifyEngineState({
        ...baseEngine,
        completionRate14d: 0.2,
        recentCompletions: 0,
      }),
    ).toBe("stalled");
  });

  it("classifies high skips as stalled", () => {
    expect(
      classifyEngineState({
        ...baseEngine,
        skipRate14d: 0.8,
        recentCompletions: 1,
      }),
    ).toBe("stalled");
  });

  it("fails open to cruising on thin data", () => {
    expect(
      classifyEngineState({
        completionRate14d: null,
        avgMinutesPerMission: null,
        skipRate14d: null,
        recentCompletions: 0,
        hardAttempts14d: 0,
        hardCompletions14d: 0,
      }),
    ).toBe("cruising");
  });
});

describe("buildObservations", () => {
  it("produces behavioral observations, never clinical language", () => {
    const obs = buildObservations(baseInput());
    expect(obs.length).toBeGreaterThan(0);
    const joined = obs.map((o) => o.text).join(" ").toLowerCase();
    for (const term of ["diagnos", "anxiety", "trauma", "disorder", "adhd", "therapy"]) {
      expect(joined).not.toContain(term);
    }
  });

  it("handles cold start with a blank-page observation", () => {
    const obs = buildObservations(
      baseInput({
        engine: {
          completionRate14d: null,
          avgMinutesPerMission: null,
          skipRate14d: null,
          recentCompletions: 0,
          hardAttempts14d: 0,
          hardCompletions14d: 0,
        },
      }),
    );
    expect(obs.some((o) => o.key === "fresh-start")).toBe(true);
  });
});

describe("buildBodyToolkit", () => {
  it("returns somatic missions plus one co-do routine", () => {
    const items = buildBodyToolkit(baseInput());
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((i) => i.kind === "routine")).toBe(true);
    expect(items.some((i) => i.kind === "somatic")).toBe(true);
  });

  it("varies the routine title by engine state", () => {
    const hot = buildBodyToolkit(
      baseInput({
        engine: { ...baseEngine, completionRate14d: 0.3, hardAttempts14d: 5, hardCompletions14d: 1 },
      }),
    );
    const stalled = buildBodyToolkit(
      baseInput({
        engine: { ...baseEngine, completionRate14d: 0.2, recentCompletions: 0 },
      }),
    );
    const hotRoutine = hot.find((i) => i.kind === "routine")!;
    const stalledRoutine = stalled.find((i) => i.kind === "routine")!;
    expect(hotRoutine.title).not.toBe(stalledRoutine.title);
  });

  it("uses together-framing in every item", () => {
    const items = buildBodyToolkit(baseInput());
    const joined = items.map((i) => i.detail).join(" ").toLowerCase();
    expect(joined).toContain("together");
    expect(joined).not.toContain("disorder");
  });
});

describe("buildGrowthPlan", () => {
  it("leads with the brightest pillar and includes a stretch", () => {
    const items = buildGrowthPlan(baseInput());
    expect(items.length).toBe(3);
    // together=80 is brightest in baseScores
    expect(items[0].pillar).toBe("together");
    expect(items[0].title.toLowerCase()).toContain("shining");
    // growing=45 (giving) framed as blooming
    expect(items[1].title.toLowerCase()).toContain("blooming");
  });

  it("never frames the growing edge as a problem", () => {
    const items = buildGrowthPlan(baseInput());
    const joined = items.map((i) => i.detail).join(" ").toLowerCase();
    expect(joined).not.toContain("problem");
    expect(joined).not.toContain("fix");
    expect(joined).not.toContain("behind");
  });
});

describe("assembleBlueprint", () => {
  it("assembles all three parts deterministically", () => {
    const bp = assembleBlueprint(baseInput());
    expect(bp.childId).toBe("child-1");
    expect(bp.engineState).toBe("cruising");
    expect(bp.observations.length).toBeGreaterThan(0);
    expect(bp.bodyToolkit.length).toBeGreaterThan(0);
    expect(bp.growthPlan.length).toBe(3);
    expect(bp.mode).toBe("deterministic");
    expect(bp.narrative).toBeNull();
    expect(FLOURISH_PILLARS).toContain(bp.brightestPillar);
    expect(FLOURISH_PILLARS).toContain(bp.growingPillar);
  });

  it("is deterministic for the same input", () => {
    const a = assembleBlueprint(baseInput());
    const b = assembleBlueprint(baseInput());
    expect(a.engineState).toBe(b.engineState);
    expect(a.observations.map((o) => o.key)).toEqual(b.observations.map((o) => o.key));
    expect(a.bodyToolkit.map((i) => i.key)).toEqual(b.bodyToolkit.map((i) => i.key));
  });
});

describe("narration prompts", () => {
  const input = {
    engineState: "cruising" as const,
    ageBand: "7-9" as const,
    observationTexts: ["A steady rhythm lately."],
    brightestPillar: "together" as const,
    growingPillar: "giving" as const,
    bodyTitles: ["Slow Brush Club"],
    growthTitles: ["Togetherness is shining"],
  };

  it("system prompt bans clinical language and centers the parent", () => {
    const sys = buildBlueprintSystemPrompt();
    expect(sys.toLowerCase()).toContain("never diagnose");
    expect(sys).toContain("side by side");
  });

  it("user prompt carries facts, never PII", () => {
    const user = buildBlueprintUserPrompt(input);
    expect(user).toContain("7-9");
    expect(user).not.toContain("child-1");
  });

  it("fallback narrative is warm, short, and safe", () => {
    const fb = blueprintFallbackNarrative(input);
    expect(fb.length).toBeLessThan(600);
    expect(fb.length).toBeGreaterThan(20);
    expect(fb).not.toContain("!");
    const hit = sanitizeBlueprintNarration("This child shows signs of anxiety and trauma.");
    expect(hit).toBeNull();
  });

  it("sanitizer rejects clinical terms and length violations", () => {
    expect(sanitizeBlueprintNarration("Your child has ADHD symptoms.")).toBeNull();
    expect(sanitizeBlueprintNarration("Too short")).toBeNull();
    expect(sanitizeBlueprintNarration("x".repeat(700))).toBeNull();
    const good =
      "A steady rhythm is building here. Togetherness is shining brightest — keep naming it when you see it, side by side.";
    expect(sanitizeBlueprintNarration(good)).toBe(good);
  });
});

describe("validateBlueprintInput", () => {
  it("accepts a valid childId", () => {
    expect(validateBlueprintInput({ childId: "abc" })).toEqual({ ok: true, childId: "abc" });
  });
  it("rejects missing or bad childId", () => {
    expect(validateBlueprintInput({}).ok).toBe(false);
    expect(validateBlueprintInput(null).ok).toBe(false);
    expect(validateBlueprintInput({ childId: "" }).ok).toBe(false);
    expect(validateBlueprintInput({ childId: 42 }).ok).toBe(false);
  });
});
