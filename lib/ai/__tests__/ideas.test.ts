import { describe, expect, it } from "vitest";
import type { LifeSkillKey } from "@/lib/domain/family-types";
import {
  IDEA_AGE_BANDS,
  IDEA_LIFE_SKILLS,
  IDEAS_MODEL_ID,
  MAX_IDEA_NAME_LENGTH,
  ageBandForAge,
  buildIdeasMessages,
  buildIdeasSystemPrompt,
  buildIdeasUserMessage,
  parseIdeasResponse,
  validateIdeasInput,
} from "../ideas";

// Compile-time guard: the worker-safe skill list must stay in sync with
// the domain LifeSkillKey union.
const _skillSyncCheck: readonly LifeSkillKey[] = IDEA_LIFE_SKILLS;
void _skillSyncCheck;

describe("validateIdeasInput", () => {
  const valid = { lifeSkill: "kindness", childFirstName: "Aarav", ageBand: "7-9" };

  it("accepts a valid request", () => {
    const result = validateIdeasInput({ lifeSkill: "responsibility", childFirstName: "  Mia  ", ageBand: "4-6" });
    expect(result).toEqual({
      ok: true,
      value: { lifeSkill: "responsibility", childFirstName: "Mia", ageBand: "4-6" },
    });
  });

  it("rejects an unknown lifeSkill", () => {
    const result = validateIdeasInput({ ...valid, lifeSkill: "kindness" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("lifeSkill");
  });

  it("rejects each lifeSkill outside the UI list", () => {
    for (const bad of ["", "hacking", "RESPONSIBILITY", null, 42]) {
      const result = validateIdeasInput({ lifeSkill: bad, childFirstName: "Mia", ageBand: "7-9" });
      expect(result.ok).toBe(false);
    }
    // Every documented skill passes.
    for (const skill of IDEA_LIFE_SKILLS) {
      const result = validateIdeasInput({ lifeSkill: skill, childFirstName: "Mia", ageBand: "7-9" });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects an unknown ageBand", () => {
    for (const bad of ["3-5", "7 - 9", "", null]) {
      const result = validateIdeasInput({ lifeSkill: "empathy", childFirstName: "Mia", ageBand: bad });
      expect(result.ok).toBe(false);
    }
    for (const band of IDEA_AGE_BANDS) {
      const result = validateIdeasInput({ lifeSkill: "empathy", childFirstName: "Mia", ageBand: band });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects an empty or missing childFirstName", () => {
    for (const bad of ["", "   ", null, undefined, 7]) {
      const result = validateIdeasInput({ lifeSkill: "teamwork", childFirstName: bad, ageBand: "10-12" });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects an overlong childFirstName", () => {
    const result = validateIdeasInput({
      lifeSkill: "leadership",
      childFirstName: "x".repeat(MAX_IDEA_NAME_LENGTH + 1),
      ageBand: "7-9",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_IDEA_NAME_LENGTH));
  });

  it("rejects non-object bodies", () => {
    for (const bad of [null, undefined, "string", 42, ["array"]]) {
      expect(validateIdeasInput(bad).ok).toBe(false);
    }
  });
});

describe("ageBandForAge", () => {
  it("maps ages to the documented bands", () => {
    expect(ageBandForAge(4)).toBe("4-6");
    expect(ageBandForAge(6)).toBe("4-6");
    expect(ageBandForAge(7)).toBe("7-9");
    expect(ageBandForAge(9)).toBe("7-9");
    expect(ageBandForAge(10)).toBe("10-12");
    expect(ageBandForAge(12)).toBe("10-12");
    expect(ageBandForAge(15)).toBe("10-12");
  });
});

describe("prompt building", () => {
  const input = { lifeSkill: "responsibility" as const, childFirstName: "Mia", ageBand: "7-9" as const };

  it("system prompt carries the guardrails", () => {
    const prompt = buildIdeasSystemPrompt();
    expect(prompt).toContain("PARENTS");
    expect(prompt).toContain("JSON array");
    expect(prompt).toContain("medical");
    expect(prompt).toContain("open-ended chat");
    expect(prompt).toContain("diagnos");
  });

  it("user message carries only the allowed fields", () => {
    const message = buildIdeasUserMessage(input);
    expect(message).toContain("responsibility");
    expect(message).toContain("Mia");
    expect(message).toContain("7-9");
  });

  it("messages are system-first", () => {
    const messages = buildIdeasMessages(input);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
  });

  it("uses the verified free-tier model id", () => {
    expect(IDEAS_MODEL_ID).toBe("@cf/meta/llama-3.1-8b-instruct-fp8");
  });
});

describe("parseIdeasResponse", () => {
  it("parses a clean JSON array", () => {
    expect(parseIdeasResponse('["Water the plants together.", "Sort recycling."]')).toEqual([
      "Water the plants together.",
      "Sort recycling.",
    ]);
  });

  it("parses an object with an ideas key", () => {
    expect(parseIdeasResponse('{"ideas": ["A", "B"]}')).toEqual(["A", "B"]);
  });

  it("salvages JSON embedded in prose", () => {
    expect(parseIdeasResponse('Here you go: ["A", "B"] enjoy!')).toEqual(["A", "B"]);
  });

  it("falls back to line parsing for non-JSON", () => {
    const raw = "1. Water the plants together.\n- Sort recycling with a parent.\n* Wipe the table.";
    expect(parseIdeasResponse(raw)).toEqual([
      "Water the plants together.",
      "Sort recycling with a parent.",
      "Wipe the table.",
    ]);
  });

  it("drops non-string items and empties", () => {
    expect(parseIdeasResponse('["A", 42, null, "  ", "B"]')).toEqual(["A", "B"]);
  });

  it("returns [] for malformed input", () => {
    for (const bad of ["", "   ", "not json at all {{{", '{"ideas": "nope"}', '{"ideas": []}']) {
      expect(parseIdeasResponse(bad)).toEqual([]);
    }
  });
});
