import { describe, expect, it } from "vitest";
import {
  detectIndependenceMilestones,
  independenceSummaryForParent,
  milestoneInsightCopy,
  type IndependenceEvent,
} from "../independence";

const DAY = 86_400_000;

function ev(daysAgo: number, opts: Partial<IndependenceEvent> = {}): IndependenceEvent {
  return {
    completedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    status: "approved",
    difficulty: "easy",
    category: "chore",
    ...opts,
  };
}

describe("detectIndependenceMilestones", () => {
  it("returns all 8 milestones with empty events", () => {
    const ms = detectIndependenceMilestones([]);
    expect(ms).toHaveLength(8);
    expect(ms.every((m) => m.progress === 0 || m.id === "first-steps")).toBe(true);
    expect(ms[0].id).toBe("first-steps");
  });

  it("celebrates first steps on the first approved mission", () => {
    const ms = detectIndependenceMilestones([ev(2)]);
    const first = ms.find((m) => m.id === "first-steps")!;
    expect(first.progress).toBe(1);
    expect(first.achievedAt).not.toBeNull();
  });

  it("ignores rejected missions for milestones", () => {
    const ms = detectIndependenceMilestones([
      ev(2, { status: "rejected" }),
      ev(1, { status: "rejected" }),
    ]);
    const first = ms.find((m) => m.id === "first-steps")!;
    expect(first.progress).toBe(0);
  });

  it("detects a 3-day streak as steady rhythm", () => {
    const ms = detectIndependenceMilestones([ev(3), ev(2), ev(1)]);
    const rhythm = ms.find((m) => m.id === "steady-rhythm")!;
    expect(rhythm.progress).toBe(1);
  });

  it("tracks partial streak progress without pressure", () => {
    const ms = detectIndependenceMilestones([ev(2), ev(1)]);
    const rhythm = ms.find((m) => m.id === "steady-rhythm")!;
    expect(rhythm.progress).toBeCloseTo(2 / 3, 2);
    expect(rhythm.progressLabel).toBe("2 of 3 days");
  });

  it("detects a 7-day streak as week warrior", () => {
    const events = [7, 6, 5, 4, 3, 2, 1].map((d) => ev(d));
    const ms = detectIndependenceMilestones(events);
    expect(ms.find((m) => m.id === "week-warrior")!.progress).toBe(1);
  });

  it("celebrates the first hard mission as brave solo", () => {
    const ms = detectIndependenceMilestones([ev(2), ev(1, { difficulty: "hard" })]);
    const brave = ms.find((m) => m.id === "brave-solo")!;
    expect(brave.progress).toBe(1);
    expect(brave.achievedAt).not.toBeNull();
  });

  it("detects category breadth as explorer", () => {
    const ms = detectIndependenceMilestones([
      ev(4, { category: "chore" }),
      ev(3, { category: "kindness" }),
      ev(2, { category: "pet_care" }),
      ev(1, { category: "money" }),
    ]);
    expect(ms.find((m) => m.id === "explorer")!.progress).toBe(1);
  });

  it("detects a comeback after 3+ days away", () => {
    const ms = detectIndependenceMilestones([ev(10), ev(1)]);
    const comeback = ms.find((m) => m.id === "comeback")!;
    expect(comeback.progress).toBe(1);
    expect(comeback.achievedAt).not.toBeNull();
  });

  it("does not flag a comeback for consecutive days", () => {
    const ms = detectIndependenceMilestones([ev(2), ev(1)]);
    expect(ms.find((m) => m.id === "comeback")!.progress).toBe(0);
  });

  it("detects helper-free runs only when parent-help data exists", () => {
    const solo = [5, 4, 3, 2, 1].map((d) => ev(d, { parentHelped: false }));
    const ms = detectIndependenceMilestones(solo);
    expect(ms.find((m) => m.id === "helper-free")!.progress).toBe(1);

    // Without helper data, stays locked without pressure
    const noData = [5, 4, 3, 2, 1].map((d) => ev(d));
    const ms2 = detectIndependenceMilestones(noData);
    const locked = ms2.find((m) => m.id === "helper-free")!;
    expect(locked.progress).toBe(0);
    expect(locked.progressLabel).toBe("");
  });

  it("resets the helper-free run when parent helps", () => {
    const events = [
      ev(6, { parentHelped: false }),
      ev(5, { parentHelped: false }),
      ev(4, { parentHelped: true }),
      ev(3, { parentHelped: false }),
      ev(2, { parentHelped: false }),
    ];
    const ms = detectIndependenceMilestones(events);
    const hf = ms.find((m) => m.id === "helper-free")!;
    expect(hf.progress).toBeCloseTo(2 / 5, 2);
  });

  it("tracks marathon progress toward 25 missions", () => {
    const events = Array.from({ length: 10 }, (_, i) => ev(10 - i));
    const ms = detectIndependenceMilestones(events);
    const marathon = ms.find((m) => m.id === "marathon")!;
    expect(marathon.progress).toBeCloseTo(10 / 25, 2);
    expect(marathon.progressLabel).toBe("10 of 25");
  });

  it("never labels or shames in milestone copy", () => {
    const ms = detectIndependenceMilestones([ev(1)]);
    const banned = ["lazy", "behind", "failing", "bad", "wrong", "should have"];
    for (const m of ms) {
      const text = `${m.title} ${m.description}`.toLowerCase();
      for (const word of banned) {
        expect(text).not.toContain(word);
      }
    }
  });
});

describe("independenceSummaryForParent", () => {
  it("tells a warm story for a new child", () => {
    const ms = detectIndependenceMilestones([]);
    const summary = independenceSummaryForParent(ms, "Maya");
    expect(summary).toContain("Maya");
    expect(summary).toContain("just getting started");
  });

  it("celebrates unlocked milestones without scores", () => {
    const ms = detectIndependenceMilestones([ev(3), ev(2), ev(1)]);
    const summary = independenceSummaryForParent(ms, "Maya");
    expect(summary).toContain("Maya");
    expect(summary).not.toMatch(/\d+\.\d+/); // no decimal scores
    expect(summary.toLowerCase()).not.toContain("score");
  });
});

describe("milestoneInsightCopy", () => {
  it("returns null for unachieved milestones", () => {
    const ms = detectIndependenceMilestones([]);
    const first = ms.find((m) => m.id === "brave-solo")!;
    expect(milestoneInsightCopy(first, "Maya")).toBeNull();
  });

  it("returns strength-first copy for achieved milestones", () => {
    const ms = detectIndependenceMilestones([ev(1, { difficulty: "hard" })]);
    const brave = ms.find((m) => m.id === "brave-solo")!;
    const copy = milestoneInsightCopy(brave, "Maya")!;
    expect(copy.strength).toContain("Maya");
    expect(copy.observation.toLowerCase()).not.toContain("bad");
    expect(copy.suggestion).toContain("lantern");
  });
});
