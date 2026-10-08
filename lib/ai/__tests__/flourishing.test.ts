import { describe, expect, it } from "vitest";
import {
  FLOURISH_PILLAR_LABELS,
  FLOURISH_PILLAR_TAGLINES,
  FLOURISH_PILLARS,
  brightestPillar,
  buildFlourishSystemPrompt,
  buildFlourishUserPrompt,
  buildFlourishingSnapshot,
  computeFlourishScores,
  computeFlourishTrends,
  flourishFallbackNarrative,
  sanitizeFlourishNarration,
  validateFlourishInput,
  weekStartIso,
  type FlourishBankInput,
  type FlourishBadgeInput,
  type FlourishEventInput,
  type FlourishScores,
} from "../flourishing";

const NOW = Date.parse("2026-10-08T12:00:00Z"); // a Thursday
const DAY = 86_400_000;

function ev(overrides: Partial<FlourishEventInput> = {}): FlourishEventInput {
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

/** N tasks: assigned + completed, same taskId per task. */
function completedTasks(n: number, overrides: Partial<FlourishEventInput> = {}): FlourishEventInput[] {
  const out: FlourishEventInput[] = [];
  for (let i = 0; i < n; i++) {
    const taskId = `done-${i}-${Math.random().toString(36).slice(2, 6)}`;
    out.push(ev({ eventType: "assigned", taskId, ...overrides }));
    out.push(ev({ eventType: "started", taskId, ...overrides }));
    out.push(ev({ eventType: "completed", taskId, ...overrides }));
  }
  return out;
}

describe("pillar metadata", () => {
  it("has five pillars with kid-language labels", () => {
    expect(FLOURISH_PILLARS).toHaveLength(5);
    for (const p of FLOURISH_PILLARS) {
      expect(FLOURISH_PILLAR_LABELS[p]).toMatch(/^[A-Z][a-z-]*$/);
      expect(FLOURISH_PILLAR_TAGLINES[p].length).toBeGreaterThan(5);
    }
  });

  it("labels are kid-friendly words, not clinical terms", () => {
    const all = Object.values(FLOURISH_PILLAR_LABELS).join(" ").toLowerCase();
    expect(all).not.toMatch(/perma|accomplishment|positive emotion/);
  });
});

describe("computeFlourishScores", () => {
  it("returns 0-100 scores for all five pillars", () => {
    const scores = computeFlourishScores(completedTasks(5), [], [], undefined, NOW);
    for (const p of FLOURISH_PILLARS) {
      expect(scores[p]).toBeGreaterThanOrEqual(0);
      expect(scores[p]).toBeLessThanOrEqual(100);
    }
  });

  it("cold start with no data returns neutral-ish scores", () => {
    const scores = computeFlourishScores([], [], [], undefined, NOW);
    for (const p of FLOURISH_PILLARS) {
      expect(scores[p]).toBeGreaterThanOrEqual(30);
      expect(scores[p]).toBeLessThanOrEqual(70);
    }
  });

  it("kindness missions raise togetherness", () => {
    const kind = computeFlourishScores(
      completedTasks(5, { category: "kindness" }),
      [],
      [],
      undefined,
      NOW,
    );
    const chore = computeFlourishScores(
      completedTasks(5, { category: "chore" }),
      [],
      [],
      undefined,
      NOW,
    );
    expect(kind.together).toBeGreaterThan(chore.together);
  });

  it("give transactions raise giving", () => {
    const bank: FlourishBankInput[] = [
      { category: "give", amount: 500, approved: true },
      { category: "spend", amount: 500, approved: true },
    ];
    const withGive = computeFlourishScores(completedTasks(2), [], bank, undefined, NOW);
    const withoutGive = computeFlourishScores(completedTasks(2), [], [], undefined, NOW);
    expect(withGive.giving).toBeGreaterThan(withoutGive.giving);
  });

  it("badges raise mastery", () => {
    const badges: FlourishBadgeInput[] = [
      { skill: "responsibility", earnedAt: new Date(NOW - DAY).toISOString() },
      { skill: "empathy", earnedAt: new Date(NOW - 2 * DAY).toISOString() },
    ];
    const withBadges = computeFlourishScores(completedTasks(2), badges, [], undefined, NOW);
    const withoutBadges = computeFlourishScores(completedTasks(2), [], [], undefined, NOW);
    expect(withBadges.mastery).toBeGreaterThan(withoutBadges.mastery);
  });

  it("hard missions raise stick-with-it and mastery", () => {
    const hard = computeFlourishScores(
      completedTasks(4, { difficulty: "hard" }),
      [],
      [],
      undefined,
      NOW,
    );
    const easy = computeFlourishScores(
      completedTasks(4, { difficulty: "easy" }),
      [],
      [],
      undefined,
      NOW,
    );
    expect(hard.stick).toBeGreaterThan(easy.stick);
    expect(hard.mastery).toBeGreaterThan(easy.mastery);
  });

  it("comebacks (skipped then completed) raise stick-with-it", () => {
    const taskId = "comeback-task";
    const events: FlourishEventInput[] = [
      ev({ eventType: "assigned", taskId, createdAt: new Date(NOW - 5 * DAY).toISOString() }),
      ev({ eventType: "skipped", taskId, createdAt: new Date(NOW - 4 * DAY).toISOString() }),
      ev({ eventType: "started", taskId, createdAt: new Date(NOW - DAY).toISOString() }),
      ev({ eventType: "completed", taskId, createdAt: new Date(NOW - DAY).toISOString() }),
    ];
    const withComeback = computeFlourishScores(events, [], [], undefined, NOW);
    const plain = computeFlourishScores(completedTasks(1), [], [], undefined, NOW);
    expect(withComeback.stick).toBeGreaterThan(plain.stick);
  });

  it("checkins raise joy", () => {
    // 4 assigned, 3 completed → completion headroom so the checkin nudge shows.
    const base: FlourishEventInput[] = [];
    for (let i = 0; i < 4; i++) {
      const taskId = `joy-task-${i}`;
      base.push(ev({ eventType: "assigned", taskId }));
      if (i < 3) {
        base.push(ev({ eventType: "started", taskId }));
        base.push(ev({ eventType: "completed", taskId }));
      }
    }
    const withCheckins = [...base];
    withCheckins.push(ev({ eventType: "checkin", taskId: null }));
    withCheckins.push(ev({ eventType: "checkin", taskId: null }));
    expect(computeFlourishScores(withCheckins, [], [], undefined, NOW).joy).toBeGreaterThan(
      computeFlourishScores(base, [], [], undefined, NOW).joy,
    );
  });

  it("prior scores smooth the output (no wild week-to-week swings)", () => {
    const prior: FlourishScores = { joy: 80, stick: 80, together: 80, giving: 80, mastery: 80 };
    const scores = computeFlourishScores([], [], [], prior, NOW);
    for (const p of FLOURISH_PILLARS) {
      expect(Math.abs(scores[p] - 80)).toBeLessThan(35);
    }
  });

  it("ignores events outside the 28-day window", () => {
    const old = completedTasks(10, { createdAt: new Date(NOW - 60 * DAY).toISOString() });
    const scores = computeFlourishScores(old, [], [], undefined, NOW);
    for (const p of FLOURISH_PILLARS) {
      expect(scores[p]).toBeGreaterThanOrEqual(30);
      expect(scores[p]).toBeLessThanOrEqual(70);
    }
  });
});

describe("computeFlourishTrends", () => {
  const base: FlourishScores = { joy: 60, stick: 60, together: 60, giving: 60, mastery: 60 };

  it("marks up for +5 or more", () => {
    const trends = computeFlourishTrends({ ...base, joy: 65 }, base);
    expect(trends.joy).toBe("up");
  });

  it("marks down for -5 or more", () => {
    const trends = computeFlourishTrends({ ...base, giving: 54 }, base);
    expect(trends.giving).toBe("down");
  });

  it("marks steady inside the deadband", () => {
    const trends = computeFlourishTrends({ ...base, mastery: 63 }, base);
    expect(trends.mastery).toBe("steady");
  });

  it("defaults to steady with no prior week", () => {
    const trends = computeFlourishTrends(base, undefined);
    for (const p of FLOURISH_PILLARS) expect(trends[p]).toBe("steady");
  });
});

describe("weekStartIso", () => {
  it("returns Monday of the week (2026-10-08 is a Thursday)", () => {
    expect(weekStartIso(NOW)).toBe("2026-10-05");
  });

  it("returns the same Monday for any day that week", () => {
    expect(weekStartIso(NOW - 3 * DAY)).toBe("2026-10-05"); // Monday
    expect(weekStartIso(NOW + 2 * DAY)).toBe("2026-10-05"); // Saturday
  });
});

describe("brightestPillar", () => {
  it("picks the highest score", () => {
    const scores: FlourishScores = { joy: 70, stick: 60, together: 90, giving: 50, mastery: 65 };
    expect(brightestPillar(scores)).toBe("together");
  });

  it("ties break toward joy", () => {
    const scores: FlourishScores = { joy: 70, stick: 70, together: 70, giving: 70, mastery: 70 };
    expect(brightestPillar(scores)).toBe("joy");
  });
});

describe("narration prompts", () => {
  const input = {
    scores: { joy: 70, stick: 60, together: 90, giving: 50, mastery: 65 } as FlourishScores,
    trends: { joy: "up", stick: "steady", together: "up", giving: "down", mastery: "steady" } as Record<
      (typeof FLOURISH_PILLARS)[number],
      "up" | "steady" | "down"
    >,
    brightest: "together" as const,
    ageBand: "7-9" as const,
  };

  it("system prompt enforces the voice rules", () => {
    const sys = buildFlourishSystemPrompt();
    expect(sys).toMatch(/never.*clinical/i);
    expect(sys).toMatch(/never.*compare/i);
    expect(sys).toMatch(/brightest/i);
  });

  it("user prompt carries pillar trends but no child name or PII", () => {
    const user = buildFlourishUserPrompt(input);
    expect(user).toContain("Togetherness");
    expect(user).toContain("climbing");
    expect(user).toContain("blooming"); // down-trend is framed warmly
    expect(user).not.toMatch(/\d{2,3}/); // no raw scores leaked
  });
});

describe("flourishFallbackNarrative", () => {
  it("celebrates the brightest pillar with no shame language", () => {
    const n = flourishFallbackNarrative("giving");
    expect(n).toContain("Giving");
    expect(n).not.toMatch(/weak|fail|problem|concern|worry/);
  });
});

describe("sanitizeFlourishNarration", () => {
  it("accepts a clean warm paragraph", () => {
    const good =
      "What a blooming week for Togetherness — you two are clearly having fun caring together. Keep following their delight.";
    expect(sanitizeFlourishNarration(good)).toBe(good);
  });

  it("rejects clinical language", () => {
    expect(sanitizeFlourishNarration("Your child shows signs of anxiety this week.")).toBeNull();
    expect(sanitizeFlourishNarration("No trauma here, just steady growth and joy.")).toBeNull();
  });

  it("rejects score leakage", () => {
    expect(sanitizeFlourishNarration("Joy hit 85% this week, great work together.")).toBeNull();
  });

  it("rejects too-short or too-long text", () => {
    expect(sanitizeFlourishNarration("Nice week!")).toBeNull();
    expect(sanitizeFlourishNarration("x".repeat(700))).toBeNull();
  });
});

describe("buildFlourishingSnapshot", () => {
  it("assembles a complete snapshot", () => {
    const scores: FlourishScores = { joy: 70, stick: 60, together: 90, giving: 50, mastery: 65 };
    const last: FlourishScores = { joy: 60, stick: 60, together: 80, giving: 60, mastery: 60 };
    const snap = buildFlourishingSnapshot("child-1", scores, last, "Lovely week!", "ai", NOW);
    expect(snap.childId).toBe("child-1");
    expect(snap.weekStart).toBe("2026-10-05");
    expect(snap.brightest).toBe("together");
    expect(snap.trends.together).toBe("up");
    expect(snap.trends.giving).toBe("down");
    expect(snap.mode).toBe("ai");
    expect(snap.computedAt).toBe(new Date(NOW).toISOString());
  });
});

describe("validateFlourishInput", () => {
  it("accepts a valid childId", () => {
    expect(validateFlourishInput({ childId: "abc-123" })).toEqual({ ok: true, childId: "abc-123" });
  });

  it("rejects missing or bad input", () => {
    expect(validateFlourishInput(null).ok).toBe(false);
    expect(validateFlourishInput({}).ok).toBe(false);
    expect(validateFlourishInput({ childId: 42 }).ok).toBe(false);
    expect(validateFlourishInput({ childId: "" }).ok).toBe(false);
  });
});
