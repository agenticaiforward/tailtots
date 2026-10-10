import { describe, expect, it } from "vitest";
import {
  CALM_LANGUAGE_RULES,
  calmNudgeMessage,
  scanForAlarmistLanguage,
  shouldThrottleInsights,
  strengthFirstOrdering,
  trackParentEngagement,
  validateCalmCopy,
} from "../parent-state";

const NOW = Date.parse("2026-10-09T12:00:00Z");
const HOUR = 3_600_000;

function opens(n: number, withinHours = 20): { openedAt: string }[] {
  const out: { openedAt: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ openedAt: new Date(NOW - i * (withinHours / Math.max(n, 1)) * HOUR).toISOString() });
  }
  return out;
}

describe("trackParentEngagement", () => {
  it("classifies 2 opens/day as healthy", () => {
    const s = trackParentEngagement(opens(2), NOW);
    expect(s.level).toBe("healthy");
    expect(s.opensLast24h).toBe(2);
    expect(s.needsCalmNudge).toBe(false);
  });
  it("classifies 4 opens/day as elevated", () => {
    const s = trackParentEngagement(opens(4), NOW);
    expect(s.level).toBe("elevated");
    expect(s.needsCalmNudge).toBe(false);
  });
  it("classifies 6+ opens/day as compulsive", () => {
    const s = trackParentEngagement(opens(7), NOW);
    expect(s.level).toBe("compulsive");
    expect(s.opensLast24h).toBe(7);
    expect(s.needsCalmNudge).toBe(true);
  });
  it("ignores stale events outside the 7d window", () => {
    const old = [{ openedAt: new Date(NOW - 10 * 24 * HOUR).toISOString() }];
    const s = trackParentEngagement(old, NOW);
    expect(s.level).toBe("healthy");
    expect(s.opensLast24h).toBe(0);
  });
  it("handles empty input", () => {
    const s = trackParentEngagement([], NOW);
    expect(s.level).toBe("healthy");
  });
});

describe("shouldThrottleInsights", () => {
  it("throttles only compulsive parents", () => {
    expect(shouldThrottleInsights(trackParentEngagement(opens(7), NOW))).toBe(true);
    expect(shouldThrottleInsights(trackParentEngagement(opens(4), NOW))).toBe(false);
    expect(shouldThrottleInsights(trackParentEngagement(opens(1), NOW))).toBe(false);
  });
});

describe("calmNudgeMessage", () => {
  it("is warm, non-shaming, and passes calm validation", () => {
    const msg = calmNudgeMessage();
    expect(msg.length).toBeGreaterThan(20);
    expect(validateCalmCopy(msg)).toEqual([]);
  });
});

describe("strengthFirstOrdering", () => {
  it("leads with the strength", () => {
    const out = strengthFirstOrdering({
      strength: "Maya's generosity is blooming.",
      growthArea: "Thursdays are still tricky.",
      suggestion: "Try a 3-minute pet wind-down.",
    });
    expect(out.startsWith("Maya's generosity is blooming.")).toBe(true);
    expect(out).toContain("Thursdays are still tricky.");
    expect(out).toContain("Try a 3-minute pet wind-down.");
  });
});

describe("scanForAlarmistLanguage", () => {
  it("flags banned phrases", () => {
    expect(scanForAlarmistLanguage("This is a red flag")).toBe("red flag");
    expect(scanForAlarmistLanguage("She is falling behind")).toBe("falling behind");
    expect(scanForAlarmistLanguage("WARNING: concern")).toBe("warning");
  });
  it("passes calm copy", () => {
    expect(scanForAlarmistLanguage("Worth paying attention to this week.")).toBeNull();
  });
});

describe("validateCalmCopy", () => {
  it("flags exclamation marks and emojis", () => {
    expect(validateCalmCopy("Great job!")).toContain("exclamation mark");
    expect(validateCalmCopy("Great job 🎉")).toContain("emoji");
  });
  it("returns empty for clean copy", () => {
    expect(validateCalmCopy("Maya's generosity is blooming. Thursdays are worth paying attention to.")).toEqual([]);
  });
});

describe("CALM_LANGUAGE_RULES", () => {
  it("exports banned phrases and required framing", () => {
    expect(CALM_LANGUAGE_RULES.bannedPhrases.length).toBeGreaterThan(5);
    expect(CALM_LANGUAGE_RULES.requiredFraming.length).toBeGreaterThan(3);
    expect(CALM_LANGUAGE_RULES.maxSeverityPhrasing).toBe("worth paying attention to");
  });
});
