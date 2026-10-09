import { describe, expect, it } from "vitest";
import {
  ELO_START_RATING,
  ELO_K_FACTOR,
  ELO_MIN_RATING,
  ELO_MAX_RATING,
  DIFFICULTY_RATINGS,
  HARD_SIGNALS_TO_STEP_DOWN,
  EASY_SIGNALS_TO_STEP_UP,
  WINS_TO_FADE_SCAFFOLD,
  expectedScore,
  updateEloRating,
  initialEloState,
  bandForRating,
  detectFlowSignals,
  calibrateFlowBand,
  detectBraveTry,
  trackScaffoldFade,
  buildDifficultyNudge,
  runFlowCalibration,
  fetchFlowCalibration,
  type FlowEventInput,
} from "../flow-calibration";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const DAY = 86_400_000;

function ev(partial: Partial<FlowEventInput> & { eventType: string }): FlowEventInput {
  return {
    childId: "c1",
    category: "chore",
    createdAt: new Date(NOW - 5 * DAY).toISOString(),
    ...partial,
  };
}

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });
  it("favors the higher-rated side", () => {
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.9);
    expect(expectedScore(1000, 1400)).toBeLessThan(0.1);
  });
});

describe("updateEloRating", () => {
  it("moves up on completion, more for beating a harder mission", () => {
    const easyWin = updateEloRating(1200, "easy", "completed");
    const hardWin = updateEloRating(1200, "hard", "completed");
    expect(easyWin).toBeGreaterThan(1200);
    expect(hardWin).toBeGreaterThan(easyWin);
  });
  it("moves down gently on abandonment (half-K grace)", () => {
    const after = updateEloRating(1200, "medium", "abandoned");
    expect(after).toBeLessThan(1200);
    // half-K: drop is at most K/2 = 8
    expect(1200 - after).toBeLessThanOrEqual(ELO_K_FACTOR / 2);
  });
  it("never moves on attempted (Brave Try): data, not failure", () => {
    expect(updateEloRating(1200, "hard", "attempted")).toBe(1200);
  });
  it("clamps to min/max bounds", () => {
    expect(updateEloRating(ELO_MAX_RATING, "easy", "completed")).toBeLessThanOrEqual(ELO_MAX_RATING);
    expect(updateEloRating(ELO_MIN_RATING, "hard", "abandoned")).toBeGreaterThanOrEqual(ELO_MIN_RATING);
  });
  it("K-factor is small: single win moves < K points", () => {
    const after = updateEloRating(ELO_START_RATING, "medium", "completed");
    expect(after - ELO_START_RATING).toBeLessThanOrEqual(ELO_K_FACTOR);
    expect(after - ELO_START_RATING).toBeGreaterThan(0);
  });
});

describe("bandForRating", () => {
  it("maps ratings to bands", () => {
    expect(bandForRating(900, "10-12")).toBe("easy");
    expect(bandForRating(1200, "10-12")).toBe("medium");
    expect(bandForRating(1400, "10-12")).toBe("hard");
  });
  it("respects the age-band ceiling", () => {
    expect(bandForRating(1500, "4-6")).toBe("easy");
    expect(bandForRating(1500, "7-9")).toBe("medium");
    expect(bandForRating(1500, "10-12")).toBe("hard");
  });
});

describe("detectFlowSignals", () => {
  it("returns zero signals below the minimum sample size", () => {
    const sigs = detectFlowSignals("c1", [ev({ eventType: "completed" })], NOW);
    const chore = sigs.find((s) => s.category === "chore")!;
    expect(chore.easy.total).toBe(0);
    expect(chore.hard.total).toBe(0);
  });

  it("detects rush-through as a too-easy signal", () => {
    const events: FlowEventInput[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(ev({ eventType: "completed", difficulty: "easy", minutesToComplete: 1 })); // < 2.5 min
    }
    const sigs = detectFlowSignals("c1", events, NOW);
    expect(sigs.find((s) => s.category === "chore")!.easy.rushThrough).toBe(5);
  });

  it("detects 3x-duration as a too-hard signal", () => {
    const events: FlowEventInput[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(ev({ eventType: "completed", difficulty: "easy", minutesToComplete: 20 })); // > 15 min
    }
    const sigs = detectFlowSignals("c1", events, NOW);
    expect(sigs.find((s) => s.category === "chore")!.hard.longDuration).toBe(5);
  });

  it("detects abandonment: started but never completed", () => {
    const events: FlowEventInput[] = [
      ev({ eventType: "started", createdAt: new Date(NOW - 6 * DAY).toISOString() }),
      ev({ eventType: "started", createdAt: new Date(NOW - 5 * DAY).toISOString() }),
      ev({ eventType: "expired", createdAt: new Date(NOW - 4 * DAY).toISOString() }),
      ev({ eventType: "started", createdAt: new Date(NOW - 3 * DAY).toISOString() }),
      ev({ eventType: "completed", createdAt: new Date(NOW - 2 * DAY).toISOString() }),
    ];
    const sigs = detectFlowSignals("c1", events, NOW);
    // 3 started, 1 completed -> at least 2 abandonments
    expect(sigs.find((s) => s.category === "chore")!.hard.abandonment).toBeGreaterThanOrEqual(2);
  });

  it("detects heavy scaffold: parent-edited then completed", () => {
    const ts = new Date(NOW - 5 * DAY).toISOString();
    const events: FlowEventInput[] = [
      ev({ eventType: "edited_by_parent", createdAt: ts }),
      ev({ eventType: "completed", createdAt: ts }),
      ev({ eventType: "started" }),
      ev({ eventType: "completed" }),
      ev({ eventType: "started" }),
    ];
    const sigs = detectFlowSignals("c1", events, NOW);
    expect(sigs.find((s) => s.category === "chore")!.hard.heavyScaffold).toBe(1);
  });

  it("ignores events outside the 30-day window", () => {
    const events: FlowEventInput[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        ev({
          eventType: "completed",
          difficulty: "easy",
          minutesToComplete: 1,
          createdAt: new Date(NOW - 40 * DAY).toISOString(),
        }),
      );
    }
    const sigs = detectFlowSignals("c1", events, NOW);
    expect(sigs.find((s) => s.category === "chore")!.sampleSize).toBe(0);
  });
});

describe("calibrateFlowBand", () => {
  const base = {
    category: "chore" as const,
    sampleSize: 10,
    easy: { rushThrough: 0, skippedReflection: 0, cherryPick: 0, total: 0 },
    hard: { abandonment: 0, longDuration: 0, heavyScaffold: 0, total: 0 },
  };

  it("steps DOWN after 2 hard signals (asymmetric fast back-off)", () => {
    const sig = { ...base, hard: { abandonment: 2, longDuration: 0, heavyScaffold: 0, total: 2 } };
    const cal = calibrateFlowBand(sig, "medium", 1200, "10-12");
    expect(cal.band).toBe("easy");
    expect(cal.moved).toBe(true);
    expect(cal.moveDirection).toBe("down");
    expect(HARD_SIGNALS_TO_STEP_DOWN).toBe(2);
  });

  it("steps UP after 3 easy signals (asymmetric slow step-up)", () => {
    const sig = { ...base, easy: { rushThrough: 3, skippedReflection: 0, cherryPick: 0, total: 3 } };
    const cal = calibrateFlowBand(sig, "easy", 1200, "10-12");
    expect(cal.band).toBe("medium");
    expect(cal.moved).toBe(true);
    expect(cal.moveDirection).toBe("up");
    expect(EASY_SIGNALS_TO_STEP_UP).toBe(3);
  });

  it("does NOT step up on only 2 easy signals", () => {
    const sig = { ...base, easy: { rushThrough: 2, skippedReflection: 0, cherryPick: 0, total: 2 } };
    const cal = calibrateFlowBand(sig, "easy", 1050, "10-12"); // elo also says easy
    expect(cal.moveDirection).toBe("none");
  });

  it("never steps below easy or above the age ceiling", () => {
    const hardSig = { ...base, hard: { abandonment: 5, longDuration: 0, heavyScaffold: 0, total: 5 } };
    expect(calibrateFlowBand(hardSig, "easy", 800, "10-12").band).toBe("easy");
    const easySig = { ...base, easy: { rushThrough: 5, skippedReflection: 0, cherryPick: 0, total: 5 } };
    expect(calibrateFlowBand(easySig, "easy", 1500, "4-6").band).toBe("easy");
  });

  it("hard signals take priority over easy signals", () => {
    const sig = {
      ...base,
      easy: { rushThrough: 5, skippedReflection: 0, cherryPick: 0, total: 5 },
      hard: { abandonment: 2, longDuration: 0, heavyScaffold: 0, total: 2 },
    };
    const cal = calibrateFlowBand(sig, "medium", 1200, "10-12");
    expect(cal.moveDirection).toBe("down");
  });

  it("holds steady with no signals and matching Elo", () => {
    const cal = calibrateFlowBand(base, "medium", 1200, "10-12");
    expect(cal.moved).toBe(false);
    expect(cal.moveDirection).toBe("none");
  });
});

describe("detectBraveTry", () => {
  it("awards when a stretch mission is attempted but not completed", () => {
    const award = detectBraveTry("c1", "chore", "hard", 1200, false, NOW);
    expect(award).not.toBeNull();
    expect(award!.attemptedDifficulty).toBe("hard");
    expect(award!.ratingAtAttempt).toBe(1200);
  });

  it("does not award when the mission is completed", () => {
    expect(detectBraveTry("c1", "chore", "hard", 1200, true, NOW)).toBeNull();
  });

  it("does not award when it is not a stretch (within 100 points)", () => {
    // medium = 1200 rating vs child 1150: diff 50 < 100
    expect(detectBraveTry("c1", "chore", "medium", 1150, false, NOW)).toBeNull();
  });
});

describe("trackScaffoldFade", () => {
  it("fades after 3 consecutive wins", () => {
    const fade = trackScaffoldFade("c1", "chore", ["win", "win", "win"], "full");
    expect(fade).not.toBeNull();
    expect(fade!.toLevel).toBe("light");
    expect(fade!.consecutiveWins).toBeGreaterThanOrEqual(WINS_TO_FADE_SCAFFOLD);
  });
  it("fades light -> independent", () => {
    const fade = trackScaffoldFade("c1", "chore", ["win", "win", "win", "win"], "light");
    expect(fade!.toLevel).toBe("independent");
  });
  it("resets on a non-win", () => {
    expect(trackScaffoldFade("c1", "chore", ["win", "win", "other", "win", "win"], "full")).toBeNull();
  });
  it("never fades past independent", () => {
    expect(trackScaffoldFade("c1", "chore", ["win", "win", "win"], "independent")).toBeNull();
  });
});

describe("buildDifficultyNudge", () => {
  it("uses a {name} placeholder, never a real name", () => {
    for (const kind of ["step_up", "step_down", "brave_try", "scaffold_fade", "steady"] as const) {
      const copy = buildDifficultyNudge(kind, "chore");
      expect(copy).toContain("{name}");
    }
  });
  it("contains no clinical terms", () => {
    const clinical = ["diagnos", "anxiety", "depress", "adhd", "trauma", "disorder", "therapy", "clinical"];
    for (const kind of ["step_up", "step_down", "brave_try", "scaffold_fade", "steady"] as const) {
      const copy = buildDifficultyNudge(kind, "kindness").toLowerCase();
      for (const term of clinical) {
        expect(copy).not.toContain(term);
      }
    }
  });
  it("celebrates brave tries without mentioning failure", () => {
    const copy = buildDifficultyNudge("brave_try", "pet_care");
    expect(copy.toLowerCase()).toContain("brave");
    expect(copy.toLowerCase()).not.toContain("fail");
  });
});

describe("runFlowCalibration", () => {
  it("runs a full pass across categories and returns bands + nudges", () => {
    const events: FlowEventInput[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(ev({ eventType: "completed", difficulty: "easy", minutesToComplete: 1 }));
    }
    const result = runFlowCalibration({
      childId: "c1",
      ageBand: "10-12",
      events,
      currentBands: { chore: "easy" },
      eloStates: {},
      now: NOW,
    });
    expect(result.bands.chore).toBeDefined();
    expect(result.calibrations.length).toBeGreaterThan(0);
    expect(result.eloStates.chore.rating).toBe(ELO_START_RATING);
  });

  it("is deterministic: same inputs -> same outputs", () => {
    const input = {
      childId: "c1",
      ageBand: "7-9" as const,
      events: [ev({ eventType: "completed", difficulty: "medium" })],
      currentBands: {},
      eloStates: {},
      now: NOW,
    };
    const a = runFlowCalibration(input);
    const b = runFlowCalibration(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("emits a nudge when a band moves", () => {
    const events: FlowEventInput[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(ev({ eventType: "completed", difficulty: "easy", minutesToComplete: 1 }));
    }
    const result = runFlowCalibration({
      childId: "c1",
      ageBand: "10-12",
      events,
      currentBands: { chore: "easy" },
      eloStates: {},
      now: NOW,
    });
    // 6 rush-throughs >= 3 easy signals -> step up -> nudge emitted
    const nudge = result.nudges.find((n) => n.category === "chore");
    expect(nudge).toBeDefined();
    expect(nudge!.kind).toBe("step_up");
  });
});

describe("fetchFlowCalibration", () => {
  it("returns ok:false without a token", async () => {
    const r = await fetchFlowCalibration({ token: null, childId: "c1" });
    expect(r.ok).toBe(false);
  });
  it("returns ok:false without a childId", async () => {
    const r = await fetchFlowCalibration({ token: "t", childId: "" });
    expect(r.ok).toBe(false);
  });
  it("returns data on success", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ bands: { chore: "medium" }, calibrations: [], nudges: [] }), {
        status: 200,
      });
    const r = await fetchFlowCalibration({ fetchFn: fetchFn as typeof fetch, token: "t", childId: "c1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.bands.chore).toBe("medium");
  });
  it("fails closed on network errors", async () => {
    const fetchFn = async () => {
      throw new Error("down");
    };
    const r = await fetchFlowCalibration({ fetchFn: fetchFn as typeof fetch, token: "t", childId: "c1" });
    expect(r.ok).toBe(false);
  });
});

describe("integration: snapshot builder accepts flowBands", () => {
  it("flow-calibrated bands override the basic calibration", async () => {
    const { buildChildSnapshot } = await import("../mission-engine");
    const snap = buildChildSnapshot({
      child: { age: 8, streakDays: 0, lastStreakDate: null },
      completions: [],
      awards: [],
      pets: [],
      flowBands: { chore: "hard", kindness: "easy" },
      now: NOW,
    });
    expect(snap.calibratedDifficulty.chore).toBe("hard");
    expect(snap.calibratedDifficulty.kindness).toBe("easy");
  });
});
