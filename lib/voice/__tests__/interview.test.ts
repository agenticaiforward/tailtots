import { describe, it, expect } from "vitest";
import {
  startInterview,
  advanceInterview,
  reflectionInterview,
  briefingInterview,
  parentWeeklyInterview,
  setupInterview,
  demoInterview,
  matchInterviewTrigger,
  type InterviewContext,
  type InterviewSession,
} from "../interview";

const kidCtx: InterviewContext = { kidName: "Maya Carter", missions: [{ id: "m1", title: "Feed Cocoa", points: 10 }] };

function run(
  def: typeof reflectionInterview,
  ctx: InterviewContext,
  utterances: string[],
): { speaks: string[]; lastSave?: Record<string, string>; lastStopped: boolean } {
  const speaks: string[] = [];
  let turn = startInterview(def, ctx);
  speaks.push(turn.speak);
  let session: InterviewSession = turn.session;
  let lastSave: Record<string, string> | undefined;
  let lastStopped = false;
  for (const u of utterances) {
    const t = advanceInterview(def, session, u, ctx);
    session = t.session;
    speaks.push(t.speak);
    lastSave = t.saveAnswers;
    lastStopped = t.stopped;
    if (t.done) break;
  }
  return { speaks, lastSave, lastStopped };
}

describe("interview engine", () => {
  it("reflection: asks three questions, stores answers, summarizes + saves", () => {
    const { speaks, lastSave } = run(reflectionInterview, kidCtx, [
      "feeding Cocoa",
      "the math page was hard",
      "um, ride my bike",
    ]);
    expect(speaks[0]).toContain("proudest");
    expect(speaks[1]).toContain("hard");
    expect(speaks[2]).toContain("tomorrow");
    expect(speaks[3]).toContain("growth log");
    expect(lastSave).toEqual({ proud: "feeding Cocoa", hard: "the math page was hard", tomorrow: "ride my bike" });
  });

  it("reflection without missions asks what good thing they did", () => {
    const { speaks } = run(reflectionInterview, { kidName: "Eli" }, ["helped my sister"]);
    expect(speaks[0]).toContain("something good");
  });

  it("skip leaves the slot empty and moves on; stop mid-way saves partial (reflection)", () => {
    const { speaks, lastSave, lastStopped } = run(reflectionInterview, kidCtx, ["skip", "stop"]);
    expect(speaks[1]).toContain("hard");
    expect(lastStopped).toBe(true);
    expect(lastSave).toEqual({ proud: "" });
  });

  it("parent weekly: stop saves nothing", () => {
    const { lastSave, lastStopped } = run(parentWeeklyInterview, {}, ["great week", "stop"]);
    expect(lastStopped).toBe(true);
    expect(lastSave).toBeUndefined();
  });

  it("parent weekly: full run composes the summary from answers", () => {
    const { speaks, lastSave } = run(parentWeeklyInterview, {}, ["we read together", "screen time", "saying please"]);
    expect(speaks[3]).toContain("Win: we read together.");
    expect(speaks[3]).toContain("saved it");
    expect(lastSave?.practice).toBe("saying please");
  });

  it("briefing: yesno ready gate — no means no rush, yes means go", () => {
    const def = briefingInterview("Feed Cocoa");
    const no = run(def, kidCtx, ["the food bowl", "scoop the food", "no"]);
    expect(no.speaks[3]).toContain("No rush");
    const yes = run(def, kidCtx, ["the food bowl", "scoop the food", "yeah"]);
    expect(yes.speaks[3]).toContain("You've got this");
  });

  it("yesno step re-asks on a non-answer", () => {
    const def = briefingInterview("Feed Cocoa");
    const { speaks } = run(def, kidCtx, ["bowl", "scoop", "banana"]);
    expect(speaks[3]).toContain("yes or no");
  });

  it("setup: number extraction, pet-kind skip when no pet, review summary", () => {
    const { speaks, lastSave } = run(setupInterview, {}, [
      "The Carter Family",
      "Maya",
      "she is 8 years old",
      "skip",
    ]);
    expect(lastSave?.kidAge).toBe("8");
    expect(lastSave?.petName).toBe("");
    // Pet-kind step skipped → the 4th utterance already finished the interview.
    expect(speaks[speaks.length - 1]).toContain("Setup screen");
    expect(speaks[speaks.length - 1]).toContain("Maya, age 8");
  });

  it("setup: with a pet, kind is extracted from free speech", () => {
    const { lastSave } = run(setupInterview, {}, ["The Carters", "Eli", "5", "Cocoa", "a dog"]);
    expect(lastSave?.petName).toBe("Cocoa");
    expect(lastSave?.petKind).toBe("dog");
  });

  it("setup: non-skippable steps reject 'skip' gently", () => {
    const { speaks } = run(setupInterview, {}, ["skip"]);
    expect(speaks[1]).toContain("try that one");
  });

  it("demo interview completes and promises nothing is saved", () => {
    const { speaks, lastSave } = run(demoInterview, {}, ["Buddy", "fetch", "yes"]);
    expect(speaks[3]).toContain("great puppy name");
    expect(speaks[3]).toContain("saves nothing");
    expect(lastSave?.seeMissions).toBe("yes");
  });

  it("number step re-asks when no number is heard", () => {
    const { speaks } = run(setupInterview, {}, ["The Carters", "Eli", "banana"]);
    expect(speaks[3]).toContain("number");
  });
});

describe("matchInterviewTrigger", () => {
  it("routes family-mode triggers by role", () => {
    expect(matchInterviewTrigger("ask me about my day", { role: "kid", showcase: false })?.id).toBe("reflection");
    expect(matchInterviewTrigger("start my weekly check-in", { role: "parent", showcase: false })?.id).toBe("parent-weekly");
    expect(matchInterviewTrigger("set up by voice", { role: "parent", showcase: false })?.id).toBe("setup");
    expect(matchInterviewTrigger("brief me on feed cocoa", { role: "kid", showcase: false })).toEqual({
      id: "briefing",
      missionQuery: "feed cocoa",
    });
  });

  it("kid role cannot start parent interviews and vice versa", () => {
    expect(matchInterviewTrigger("start my weekly check-in", { role: "kid", showcase: false })).toBeNull();
    expect(matchInterviewTrigger("ask me about my day", { role: "parent", showcase: false })).toBeNull();
  });

  it("demo only ever starts the local demo interview", () => {
    expect(matchInterviewTrigger("interview me", { role: "kid", showcase: true })?.id).toBe("demo");
    expect(matchInterviewTrigger("set up by voice", { role: "parent", showcase: true })).toBeNull();
    expect(matchInterviewTrigger("what is my points balance", { role: "kid", showcase: true })).toBeNull();
  });
});
