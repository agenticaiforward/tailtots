import { describe, expect, it } from "vitest";
import {
  COPILOT_CATEGORY_LABELS,
  INSIGHT_TYPES,
  buildCopilotNarrationMessages,
  buildCopilotNarrationSystemPrompt,
  buildCopilotNarrationUserMessage,
  calibrateDifficultyBands,
  detectCompletionDrop,
  detectDifficultyMismatch,
  detectEngagementRise,
  detectPatterns,
  detectSkillImbalance,
  detectStreakAtRisk,
  detectWeakCategory,
  detectWeakWeekday,
  fallbackNarrative,
  narrationInputFor,
  parseCopilotNarrationResponse,
  scanNarrationForClinicalTerms,
  validateCopilotInsightsInput,
  type CopilotEventInput,
} from "../copilot";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const DAY = 86_400_000;

function ev(overrides: Partial<CopilotEventInput> = {}): CopilotEventInput {
  return {
    eventType: "assigned",
    taskId: `task-${Math.random().toString(36).slice(2, 9)}`,
    category: "chore",
    difficulty: "easy",
    skill: "responsibility",
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    ...overrides,
  };
}

/** Build N assigned tasks on a given weekday offset, with a completion ratio. */
function weekdayTasks(
  weekday: number, // 0=Sun..6=Sat
  assigned: number,
  completedRatio: number,
  daysAgoBase = 21,
): CopilotEventInput[] {
  // Find a date `daysAgoBase` days ago that falls on the target weekday.
  const base = new Date(NOW - daysAgoBase * DAY);
  const delta = (weekday - base.getDay() + 7) % 7;
  const out: CopilotEventInput[] = [];
  for (let i = 0; i < assigned; i++) {
    const taskId = `wd-${weekday}-${i}`;
    const d = new Date(base.getTime() + delta * DAY - Math.floor(i / 3) * 7 * DAY);
    out.push(
      ev({
        taskId,
        weekday,
        createdAt: d.toISOString(),
        category: "chore",
        skill: "responsibility",
      }),
    );
    if (i < Math.round(assigned * completedRatio)) {
      out.push(ev({ eventType: "completed", taskId, weekday, createdAt: new Date(d.getTime() + 3600_000).toISOString() }));
    }
  }
  return out;
}

describe("detectWeakWeekday", () => {
  it("flags a weekday far below baseline with enough samples", () => {
    const events: CopilotEventInput[] = [];
    // Strong days: Mon(1), Tue(2), Wed(3) at 80%; weak: Thu(4) at 20%.
    for (const d of [1, 2, 3]) events.push(...weekdayTasks(d, 12, 0.8));
    events.push(...weekdayTasks(4, 12, 0.2));
    const found = detectWeakWeekday(events, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].insightType).toBe("weak_weekday");
    expect(found[0].detail.weekday).toBe(4);
    expect(found[0].detail.weekdayName).toBe("Thursday");
    expect(found[0].severity).toBe("act"); // 0.2 < 0.65*0.5
  });

  it("ignores weekdays with fewer than 10 assigned", () => {
    const events: CopilotEventInput[] = [];
    for (const d of [1, 2, 3]) events.push(...weekdayTasks(d, 12, 0.8));
    events.push(...weekdayTasks(4, 5, 0)); // too few samples
    expect(detectWeakWeekday(events, NOW)).toHaveLength(0);
  });

  it("returns nothing when all weekdays are balanced", () => {
    const events: CopilotEventInput[] = [];
    for (const d of [1, 2, 3, 4]) events.push(...weekdayTasks(d, 12, 0.75));
    expect(detectWeakWeekday(events, NOW)).toHaveLength(0);
  });
});

describe("detectWeakCategory", () => {
  it("flags a category far below the child's mean", () => {
    const events: CopilotEventInput[] = [];
    for (let i = 0; i < 12; i++) {
      const id = `pc-${i}`;
      events.push(ev({ taskId: id, category: "pet_care" }));
      if (i < 10) events.push(ev({ eventType: "completed", taskId: id, category: "pet_care" }));
    }
    for (let i = 0; i < 12; i++) {
      const id = `k-${i}`;
      events.push(ev({ taskId: id, category: "kindness" }));
      if (i < 2) events.push(ev({ eventType: "completed", taskId: id, category: "kindness" }));
    }
    const found = detectWeakCategory(events, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].insightType).toBe("weak_category");
    expect(found[0].detail.category).toBe("kindness");
    expect(found[0].detail.categoryLabel).toBe("kindness");
  });
});

describe("detectCompletionDrop", () => {
  it("flags a >25% week-over-week drop", () => {
    const events: CopilotEventInput[] = [];
    // Prior 4 weeks: 20 assigned, 80% done.
    for (let i = 0; i < 20; i++) {
      const id = `prior-${i}`;
      events.push(ev({ taskId: id, createdAt: new Date(NOW - 20 * DAY).toISOString() }));
      if (i < 16) events.push(ev({ eventType: "completed", taskId: id, createdAt: new Date(NOW - 19 * DAY).toISOString() }));
    }
    // This week: 10 assigned, 40% done.
    for (let i = 0; i < 10; i++) {
      const id = `week-${i}`;
      events.push(ev({ taskId: id, createdAt: new Date(NOW - 3 * DAY).toISOString() }));
      if (i < 4) events.push(ev({ eventType: "completed", taskId: id, createdAt: new Date(NOW - 2 * DAY).toISOString() }));
    }
    const found = detectCompletionDrop(events, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].insightType).toBe("completion_drop");
  });

  it("ignores small samples", () => {
    expect(detectCompletionDrop([ev()], NOW)).toHaveLength(0);
  });
});

describe("detectStreakAtRisk", () => {
  it("flags a long streak with no completion in 2+ days", () => {
    const events = [
      ev({ eventType: "completed", createdAt: new Date(NOW - 3 * DAY).toISOString() }),
    ];
    const found = detectStreakAtRisk(events, { streakDays: 7, age: 8 }, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].insightType).toBe("streak_at_risk");
    expect(found[0].severity).toBe("watch");
  });

  it("ignores short streaks and recent completions", () => {
    const recent = [ev({ eventType: "completed", createdAt: new Date(NOW - 1 * DAY).toISOString() })];
    expect(detectStreakAtRisk(recent, { streakDays: 7, age: 8 }, NOW)).toHaveLength(0);
    expect(detectStreakAtRisk(recent, { streakDays: 3, age: 8 }, NOW)).toHaveLength(0);
  });
});

describe("detectSkillImbalance", () => {
  it("flags a 3x skill imbalance", () => {
    const events: CopilotEventInput[] = [];
    for (let i = 0; i < 12; i++) {
      events.push(ev({ eventType: "completed", skill: "responsibility", createdAt: new Date(NOW - 5 * DAY).toISOString() }));
    }
    for (let i = 0; i < 3; i++) {
      events.push(ev({ eventType: "completed", skill: "empathy", createdAt: new Date(NOW - 5 * DAY).toISOString() }));
    }
    const found = detectSkillImbalance(events, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].insightType).toBe("skill_imbalance");
    expect(found[0].detail.strongSkill).toBe("responsibility");
    expect(found[0].detail.lightSkill).toBe("empathy");
  });

  it("needs a minimum sample", () => {
    const events = [ev({ eventType: "completed", skill: "responsibility" })];
    expect(detectSkillImbalance(events, NOW)).toHaveLength(0);
  });
});

describe("detectDifficultyMismatch", () => {
  it("suggests downshift when hard fails but easy succeeds", () => {
    const events: CopilotEventInput[] = [];
    for (let i = 0; i < 10; i++) {
      const id = `hard-${i}`;
      events.push(ev({ taskId: id, category: "pet_care", difficulty: "hard" }));
      if (i < 2) events.push(ev({ eventType: "completed", taskId: id, category: "pet_care", difficulty: "hard" }));
    }
    for (let i = 0; i < 10; i++) {
      const id = `easy-${i}`;
      events.push(ev({ taskId: id, category: "pet_care", difficulty: "easy" }));
      if (i < 9) events.push(ev({ eventType: "completed", taskId: id, category: "pet_care", difficulty: "easy" }));
    }
    const found = detectDifficultyMismatch(events, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].detail.direction).toBe("downshift");
  });
});

describe("detectEngagementRise", () => {
  it("celebrates a rising week", () => {
    const events: CopilotEventInput[] = [];
    for (let i = 0; i < 20; i++) {
      const id = `prior-${i}`;
      events.push(ev({ taskId: id, createdAt: new Date(NOW - 20 * DAY).toISOString() }));
      if (i < 10) events.push(ev({ eventType: "completed", taskId: id, createdAt: new Date(NOW - 19 * DAY).toISOString() }));
    }
    for (let i = 0; i < 10; i++) {
      const id = `week-${i}`;
      events.push(ev({ taskId: id, createdAt: new Date(NOW - 3 * DAY).toISOString() }));
      if (i < 9) events.push(ev({ eventType: "completed", taskId: id, createdAt: new Date(NOW - 2 * DAY).toISOString() }));
    }
    const found = detectEngagementRise(events, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].insightType).toBe("engagement_rise");
    expect(found[0].severity).toBe("info");
  });
});

describe("detectPatterns", () => {
  it("runs all detectors and returns behavioral facts only", () => {
    const events: CopilotEventInput[] = [];
    for (const d of [1, 2, 3]) events.push(...weekdayTasks(d, 12, 0.8));
    events.push(...weekdayTasks(4, 12, 0.2));
    const found = detectPatterns(events, { streakDays: 0, age: 8 }, NOW);
    expect(found.length).toBeGreaterThan(0);
    for (const p of found) {
      expect(INSIGHT_TYPES).toContain(p.insightType);
      // No interpretation or labels in detail — only facts.
      const detailText = JSON.stringify(p.detail).toLowerCase();
      expect(detailText).not.toMatch(/anxious|trauma|adhd|diagnos/);
    }
  });
});

describe("calibrateDifficultyBands", () => {
  it("calibrates bands from 30-day rates", () => {
    const events: CopilotEventInput[] = [];
    for (let i = 0; i < 10; i++) {
      const id = `pc-${i}`;
      events.push(ev({ taskId: id, category: "pet_care" }));
      if (i < 9) events.push(ev({ eventType: "completed", taskId: id, category: "pet_care" }));
    }
    for (let i = 0; i < 10; i++) {
      const id = `ch-${i}`;
      events.push(ev({ taskId: id, category: "chore" }));
      if (i < 4) events.push(ev({ eventType: "completed", taskId: id, category: "chore" }));
    }
    const bands = calibrateDifficultyBands(events, NOW);
    const petCare = bands.find((b) => b.category === "pet_care");
    const chore = bands.find((b) => b.category === "chore");
    expect(petCare?.band).toBe("hard");
    expect(chore?.band).toBe("easy");
  });
});

describe("narration prompts", () => {
  const input = narrationInputFor(
    {
      insightType: "weak_weekday",
      severity: "watch",
      detail: { weekday: 4, weekdayName: "Thursday", rate: 0.31, baseline: 0.72, assigned: 16 },
    },
    8,
  );

  it("builds a parent-only system prompt with voice guidelines", () => {
    const sys = buildCopilotNarrationSystemPrompt();
    expect(sys).toContain("PARENT");
    expect(sys).toContain("Never diagnose");
    expect(sys).toContain("companion");
  });

  it("embeds the behavioral fact in the user message", () => {
    const user = buildCopilotNarrationUserMessage(input);
    expect(user).toContain("Thursday");
    expect(user).toContain("31%");
    expect(user).toContain("7-9");
    expect(user).not.toMatch(/Maya|child name/i);
  });

  it("produces system+user messages", () => {
    const msgs = buildCopilotNarrationMessages(input);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
  });
});

describe("parseCopilotNarrationResponse", () => {
  it("accepts a clean warm sentence", () => {
    const out = parseCopilotNarrationResponse(
      "Missions get done 31% of the time on Thursdays vs 72% usually. Try a 3-minute pet-grooming mission on Thursdays.",
    );
    expect(out).toBeTruthy();
  });

  it("rejects clinical language", () => {
    expect(parseCopilotNarrationResponse("Your child seems anxious on Thursdays, consider therapy.")).toBeNull();
  });

  it("rejects empty or absurd lengths", () => {
    expect(parseCopilotNarrationResponse("")).toBeNull();
    expect(parseCopilotNarrationResponse("ok")).toBeNull();
    expect(parseCopilotNarrationResponse("x".repeat(500))).toBeNull();
  });
});

describe("scanNarrationForClinicalTerms", () => {
  it("catches clinical terms case-insensitively", () => {
    expect(scanNarrationForClinicalTerms("This looks like ADHD behavior")).toBe("adhd");
    expect(scanNarrationForClinicalTerms("a warm, joyful message")).toBeNull();
  });
});

describe("fallbackNarrative", () => {
  it("covers every insight type with a safe, specific sentence", () => {
    for (const t of INSIGHT_TYPES) {
      const input = narrationInputFor(
        { insightType: t, severity: "info", detail: { weekdayName: "Thursday", rate: 0.3, baseline: 0.7, assigned: 12, categoryLabel: COPILOT_CATEGORY_LABELS.kindness, streakDays: 6, daysSinceCompletion: 2.5, strongSkillLabel: "responsibility", strongCount: 12, lightSkillLabel: "empathy", lightCount: 3, direction: "downshift", hardRate: 0.2, easyRate: 0.9, thisWeekRate: 0.4, priorRate: 0.7, skill: "empathy" } },
        8,
      );
      const text = fallbackNarrative(input);
      expect(text.length).toBeGreaterThan(20);
      expect(scanNarrationForClinicalTerms(text)).toBeNull();
      // Conscious-parenting voice: no shaming, no failure-centering.
      expect(text.toLowerCase()).not.toMatch(/your fault|you failed|bad parent|lazy/);
    }
  });
});

describe("validateCopilotInsightsInput", () => {
  it("accepts a valid childId and rejects garbage", () => {
    expect(validateCopilotInsightsInput({ childId: "123e4567-e89b-12d3-a456-426614174000" }).ok).toBe(true);
    expect(validateCopilotInsightsInput({}).ok).toBe(false);
    expect(validateCopilotInsightsInput(null).ok).toBe(false);
    expect(validateCopilotInsightsInput({ childId: "x" }).ok).toBe(false);
  });
});
