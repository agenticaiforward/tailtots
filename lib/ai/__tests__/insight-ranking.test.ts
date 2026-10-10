import { describe, expect, it } from "vitest";
import {
  ACTIONABILITY_SCORES,
  confidenceForSampleSize,
  noveltyFor,
  rankInsights,
  sampleSizeFor,
  scoreInsight,
  weeklyPick,
} from "../insight-ranking";
import type { DetectedPattern } from "../copilot";

function pattern(
  insightType: DetectedPattern["insightType"],
  detail: DetectedPattern["detail"] = {},
): DetectedPattern {
  return { insightType, severity: "watch", detail };
}

describe("sampleSizeFor", () => {
  it("extracts assigned counts from detail", () => {
    expect(sampleSizeFor(pattern("weak_weekday", { assigned: 14 }))).toBe(14);
  });
  it("falls back to assignedThisWeek", () => {
    expect(sampleSizeFor(pattern("completion_drop", { assignedThisWeek: 9 }))).toBe(9);
  });
  it("returns 0 when no sample info", () => {
    expect(sampleSizeFor(pattern("weak_skill", {}))).toBe(0);
  });
});

describe("confidenceForSampleSize", () => {
  it("suppresses below 8", () => {
    expect(confidenceForSampleSize(7)).toBe("low");
  });
  it("medium for 8-19", () => {
    expect(confidenceForSampleSize(8)).toBe("medium");
    expect(confidenceForSampleSize(19)).toBe("medium");
  });
  it("high for 20+", () => {
    expect(confidenceForSampleSize(20)).toBe("high");
    expect(confidenceForSampleSize(200)).toBe("high");
  });
});

describe("noveltyFor", () => {
  it("is 1.0 for fresh types", () => {
    expect(noveltyFor("weak_weekday", [])).toBe(1);
    expect(noveltyFor("weak_weekday", ["weak_category"])).toBe(1);
  });
  it("halves per recent repeat", () => {
    expect(noveltyFor("weak_weekday", ["weak_weekday"])).toBe(0.5);
    expect(noveltyFor("weak_weekday", ["weak_weekday", "weak_weekday"])).toBe(0.25);
  });
});

describe("scoreInsight", () => {
  it("scores 0 for low-confidence patterns (suppressed)", () => {
    const s = scoreInsight(pattern("weak_weekday", { assigned: 5 }));
    expect(s.confidence).toBe("low");
    expect(s.score).toBe(0);
  });
  it("scores actionability × confidence × novelty", () => {
    const s = scoreInsight(pattern("weak_weekday", { assigned: 24 }));
    expect(s.score).toBeCloseTo(ACTIONABILITY_SCORES.weak_weekday * 1.0 * 1.0);
  });
  it("celebrations score lower than actionable patterns", () => {
    const rise = scoreInsight(pattern("engagement_rise", { assignedThisWeek: 24 }));
    const weekday = scoreInsight(pattern("weak_weekday", { assigned: 24 }));
    expect(rise.score).toBeLessThan(weekday.score);
  });
});

describe("rankInsights", () => {
  it("sorts best-first and marks exactly one weekly pick", () => {
    const patterns = [
      pattern("engagement_rise", { assignedThisWeek: 24 }),
      pattern("weak_weekday", { assigned: 24 }),
      pattern("weak_category", { assigned: 24 }),
    ];
    const ranked = rankInsights(patterns);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].pattern.insightType).toBe("weak_weekday");
    expect(ranked.filter((r) => r.isWeeklyPick)).toHaveLength(1);
    expect(ranked[0].isWeeklyPick).toBe(true);
  });
  it("never picks a low-confidence pattern", () => {
    const ranked = rankInsights([pattern("weak_weekday", { assigned: 3 })]);
    expect(ranked[0].isWeeklyPick).toBe(false);
    expect(weeklyPick([pattern("weak_weekday", { assigned: 3 })])).toBeNull();
  });
  it("deprioritizes recently-surfaced types", () => {
    const patterns = [
      pattern("weak_weekday", { assigned: 24 }),
      pattern("weak_category", { assigned: 24 }),
    ];
    const ranked = rankInsights(patterns, { recentInsightTypes: ["weak_weekday"] });
    expect(ranked[0].pattern.insightType).toBe("weak_category");
  });
  it("returns empty for empty input", () => {
    expect(rankInsights([])).toEqual([]);
    expect(weeklyPick([])).toBeNull();
  });
});
