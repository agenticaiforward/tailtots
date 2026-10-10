import { describe, expect, it } from "vitest";
import {
  SEED_WONDER_MISSIONS,
  SEED_LISTENING_MISSIONS,
  wonderFor,
  listeningFor,
  buildWonderPrompt,
  validateWonderText,
  curiosityGrowthCopy,
} from "../curiosity-missions";
import {
  makeDotPair,
  validateTellItIn3,
  petReactionFor,
  spotBehaviorPattern,
  synthesisGrowthCopy,
  teachYourPetPrompt,
  weeklySynthesisQuestion,
} from "../synthesis-missions";
import {
  socraticPromptFor,
  predictionReflection,
  articulationCopy,
  WHY_BECAUSE_CHIPS,
} from "../choice-adventures";

describe("wonder missions", () => {
  it("has 2 seeds per age mode", () => {
    expect(wonderFor("sprout")).toHaveLength(2);
    expect(wonderFor("grow")).toHaveLength(2);
    expect(wonderFor("thrive")).toHaveLength(2);
  });
  it("every seed passes the anti-curiosity scan", () => {
    for (const w of SEED_WONDER_MISSIONS) {
      expect(validateWonderText(w)).toEqual([]);
    }
  });
  it("listening has 2 seeds per age mode", () => {
    expect(listeningFor("sprout")).toHaveLength(2);
    expect(listeningFor("grow")).toHaveLength(2);
    expect(listeningFor("thrive")).toHaveLength(2);
  });
});

describe("buildWonderPrompt", () => {
  it("builds without PII and rewards asking", () => {
    const { system, user } = buildWonderPrompt({
      ageMode: "grow",
      interests: ["dinosaurs"],
      traitBands: { curiosity: "growing" },
    });
    expect(system).toContain("ASKING");
    expect(system).toContain("STRICT JSON");
    expect(user).toContain("dinosaurs");
    expect(user).not.toMatch(/@|email/i);
  });
  it("avoids recent topics", () => {
    const { user } = buildWonderPrompt({
      ageMode: "sprout",
      interests: [],
      traitBands: {},
      recentTopics: ["the sky"],
    });
    expect(user).toContain("the sky");
  });
});

describe("validateWonderText", () => {
  it("flags anti-curiosity phrases", () => {
    expect(
      validateWonderText({ topic: "x", prompt: "This will test you", followUps: [] })
    ).toContain('anti-curiosity phrase: "test you"');
  });
  it("requires an invitation to ask", () => {
    expect(
      validateWonderText({ topic: "x", prompt: "Read this chapter.", followUps: [] })
    ).toContain("prompt doesn't invite asking");
  });
});

describe("curiosityGrowthCopy", () => {
  it("returns null when nothing happened", () => {
    expect(curiosityGrowthCopy("Maya", 0, 0)).toBeNull();
  });
  it("celebrates questions", () => {
    const c = curiosityGrowthCopy("Maya", 3, 1)!;
    expect(c).toContain('3 big "why" questions');
    expect(c).toContain("1 listening mission");
  });
});

describe("makeDotPair", () => {
  it("finds pairs sharing a theme", () => {
    const pair = makeDotPair([
      { title: "Fed Biscuit", category: "pet_care", emoji: "🐕" },
      { title: "Shared crayons", category: "kindness", emoji: "🖍️" },
      { title: "Saved coins", category: "money", emoji: "🪙" },
    ]);
    expect(pair).not.toBeNull();
    expect(pair!.connection).toContain("caring for another living thing");
    expect(pair!.distractors).toHaveLength(3);
  });
  it("returns null with no shared theme", () => {
    expect(
      makeDotPair([
        { title: "Fed Biscuit", category: "pet_care" },
        { title: "Saved coins", category: "money" },
      ])
    ).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(makeDotPair([])).toBeNull();
  });
});

describe("validateTellItIn3", () => {
  it("sprout: 1+ emojis counts", () => {
    expect(validateTellItIn3(["😊"], "sprout")).toBe(true);
    expect(validateTellItIn3(["", " "], "sprout")).toBe(false);
  });
  it("grow: needs 2+ sentences", () => {
    expect(validateTellItIn3(["One.", "Two."], "grow")).toBe(true);
    expect(validateTellItIn3(["One."], "grow")).toBe(false);
  });
});

describe("petReactionFor", () => {
  it("is deterministic per topic", () => {
    expect(petReactionFor("sharing")).toBe(petReactionFor("sharing"));
  });
  it("returns a non-empty reaction", () => {
    expect(petReactionFor("anything").length).toBeGreaterThan(10);
  });
});

describe("spotBehaviorPattern", () => {
  it("returns null below threshold", () => {
    expect(spotBehaviorPattern({ kind: 2 }, "Maya")).toBeNull();
    expect(spotBehaviorPattern({}, "Maya")).toBeNull();
  });
  it("spots dominant archetypes", () => {
    const spot = spotBehaviorPattern({ kind: 4, bold: 1 }, "Maya")!;
    expect(spot.observation).toContain("kind path 4 times");
    expect(spot.question).toContain("Maya");
  });
});

describe("synthesisGrowthCopy", () => {
  it("returns null when nothing happened", () => {
    expect(synthesisGrowthCopy("Leo", 0, false)).toBeNull();
  });
  it("mentions dots and teaching", () => {
    const c = synthesisGrowthCopy("Leo", 2, true, "Sharing makes people happy")!;
    expect(c).toContain("connected 2 dots");
    expect(c).toContain("taught their pet");
    expect(c).toContain("Sharing makes people happy");
  });
});

describe("teachYourPetPrompt / weeklySynthesisQuestion", () => {
  it("personalizes with pet name", () => {
    expect(teachYourPetPrompt("Biscuit", "sharing", "grow")).toContain("Biscuit");
  });
  it("asks one big question", () => {
    expect(weeklySynthesisQuestion("Ava")).toContain("BIGGEST thing");
  });
});

describe("socratic mode", () => {
  it("prompts per age mode", () => {
    expect(socraticPromptFor("sprout", "Share")).toContain("Quick guess");
    expect(socraticPromptFor("thrive", "Share")).toContain("predict the outcome");
  });
  it("celebrates correct predictions warmly", () => {
    const c = predictionReflection("happy", "happy", "Maya");
    expect(c).toContain("thinking ahead");
    expect(c).not.toContain("wrong");
  });
  it("frames surprises as learning, never failure", () => {
    const c = predictionReflection("happy", "tricky", "Maya");
    expect(c).toContain("Surprise!");
    expect(c).not.toContain("wrong");
    expect(c).not.toContain("failed");
  });
});

describe("why round", () => {
  it("has articulation chips", () => {
    expect(WHY_BECAUSE_CHIPS.length).toBeGreaterThan(3);
  });
  it("returns null for single endings", () => {
    expect(articulationCopy(1, false)).toBeNull();
  });
  it("celebrates explained comparisons", () => {
    expect(articulationCopy(3, true)).toContain("explained why");
  });
});
