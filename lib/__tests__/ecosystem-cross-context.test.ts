import { describe, expect, it } from "vitest";
import {
  BANNED_OUTPUT_WORDS,
  detectStrengthTransfer,
  scanForBannedWords,
  summarizeByContext,
} from "../ecosystem/cross-context";
import type { ContextTraitSummary } from "../ecosystem/types";

function summary(
  context: "home" | "school" | "community",
  trait: string,
  score: number,
  missionsCompleted = 5,
): ContextTraitSummary {
  return { context, trait, score, missionsCompleted };
}

describe("cross-context strength transfer", () => {
  it("fires when a strength is high in one context and low in another", () => {
    const out = detectStrengthTransfer([
      summary("community", "patience", 0.8),
      summary("home", "patience", 0.2),
    ]);
    expect(out).toHaveLength(1);
    const s = out[0];
    expect(s.strength).toBe("patience");
    expect(s.fromContext).toBe("community");
    expect(s.toContext).toBe("home");
    expect(s.forAdult).toBe("parent");
  });

  it("routes school-context suggestions to the teacher", () => {
    const out = detectStrengthTransfer([
      summary("home", "kindness", 0.85),
      summary("school", "kindness", 0.25),
    ]);
    expect(out[0].forAdult).toBe("teacher");
    expect(out[0].toContext).toBe("school");
  });

  it("requires minimum evidence in both contexts", () => {
    const out = detectStrengthTransfer([
      summary("community", "patience", 0.9, 2), // below threshold
      summary("home", "patience", 0.1, 10),
    ]);
    expect(out).toHaveLength(0);
  });

  it("does not fire when the gap is too small", () => {
    const out = detectStrengthTransfer([
      summary("community", "patience", 0.55), // below strong threshold
      summary("home", "patience", 0.35),
    ]);
    expect(out).toHaveLength(0);
  });

  it("ignores unknown traits (closed strength set)", () => {
    const out = detectStrengthTransfer([
      summary("community", "telepathy", 0.95),
      summary("home", "telepathy", 0.05),
    ]);
    expect(out).toHaveLength(0);
  });

  it("framing is strength-first and names no child", () => {
    const out = detectStrengthTransfer([
      summary("community", "perseverance", 0.8),
      summary("home", "perseverance", 0.2),
    ]);
    const framing = out[0].framing;
    expect(framing).toMatch(/strength/i);
    expect(framing).not.toMatch(/Maya|Aarush|child|kid/i);
  });

  it("output contains zero banned words across all strengths and contexts", () => {
    const strengths = [
      "patience", "kindness", "perseverance", "empathy", "confidence",
      "respect", "curiosity", "self-control", "leadership", "responsibility", "teamwork",
    ];
    const contexts = ["home", "school", "community"] as const;
    for (const trait of strengths) {
      for (const from of contexts) {
        for (const to of contexts) {
          if (from === to) continue;
          const out = detectStrengthTransfer([
            summary(from, trait, 0.85),
            summary(to, trait, 0.15),
          ]);
          for (const s of out) {
            const hits = scanForBannedWords(`${s.framing} ${s.suggestedActivity}`);
            expect(hits).toEqual([]);
          }
        }
      }
    }
  });

  it("scanForBannedWords catches deficit language", () => {
    expect(scanForBannedWords("she is struggling and impatient")).toContain("struggling");
    expect(scanForBannedWords("shows real patience")).toEqual([]);
  });

  it("banned word list covers clinical and deficit terms", () => {
    const lower = BANNED_OUTPUT_WORDS.map((w) => w.toLowerCase());
    for (const w of ["anxious", "impatient", "lazy", "behind", "failing", "weak"]) {
      expect(lower).toContain(w);
    }
  });

  it("limits output and sorts by gap", () => {
    const out = detectStrengthTransfer(
      [
        summary("community", "patience", 0.9),
        summary("home", "patience", 0.1), // gap 0.8
        summary("community", "kindness", 0.7),
        summary("home", "kindness", 0.3), // gap 0.4
      ],
      { limit: 1 },
    );
    expect(out).toHaveLength(1);
    expect(out[0].strength).toBe("patience");
  });

  it("never auto-adjusts missions — output shape has no mission directives", () => {
    const out = detectStrengthTransfer([
      summary("community", "patience", 0.8),
      summary("home", "patience", 0.2),
    ]);
    const s = out[0] as unknown as Record<string, unknown>;
    expect(s).not.toHaveProperty("missionId");
    expect(s).not.toHaveProperty("adjustDifficulty");
    expect(s).not.toHaveProperty("assignMission");
    expect(Object.keys(s).sort()).toEqual(
      ["forAdult", "framing", "fromContext", "strength", "suggestedActivity", "toContext"].sort(),
    );
  });
});

describe("summarizeByContext", () => {
  it("aggregates completion rates per context and trait", () => {
    const summaries = summarizeByContext([
      { completed: true, context: "community", traitTags: ["patience"] },
      { completed: true, context: "community", traitTags: ["patience"] },
      { completed: false, context: "community", traitTags: ["patience"] },
      { completed: true, context: "home", traitTags: ["patience"] },
    ]);
    const comm = summaries.find((s) => s.context === "community" && s.trait === "patience");
    const home = summaries.find((s) => s.context === "home" && s.trait === "patience");
    expect(comm?.score).toBeCloseTo(2 / 3);
    expect(comm?.missionsCompleted).toBe(3);
    expect(home?.score).toBe(1);
  });

  it("defaults untagged events to home and skips unknown traits", () => {
    const summaries = summarizeByContext([
      { completed: true, traitTags: ["kindness"] },
      { completed: true, traitTags: ["telepathy"] },
    ]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].context).toBe("home");
  });

  it("end-to-end: summaries feed detection", () => {
    const summaries = summarizeByContext([
      ...Array.from({ length: 5 }, () => ({
        completed: true,
        context: "community" as const,
        traitTags: ["patience"],
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        completed: i < 1,
        context: "home" as const,
        traitTags: ["patience"],
      })),
    ]);
    const out = detectStrengthTransfer(summaries);
    expect(out).toHaveLength(1);
    expect(out[0].strength).toBe("patience");
  });
});
