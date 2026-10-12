import { describe, expect, it } from "vitest";
import {
  validateQuizInput,
  buildQuizStartMessages,
  buildQuizAnswerMessages,
  parseQuizStart,
  parseQuizAnswer,
} from "../quiz";

describe("validateQuizInput", () => {
  it("accepts a valid start request", () => {
    const r = validateQuizInput({ action: "start", topic: "dinosaurs", age: 7 });
    expect(r.ok).toBe(true);
  });
  it("rejects start without topic", () => {
    expect(validateQuizInput({ action: "start" }).ok).toBe(false);
  });
  it("rejects unknown action", () => {
    expect(validateQuizInput({ action: "dance" }).ok).toBe(false);
  });
  it("accepts an answer request", () => {
    const r = validateQuizInput({ action: "answer", answer: "T rex" });
    expect(r.ok).toBe(true);
  });
});

describe("buildQuizStartMessages", () => {
  it("uses 3 questions for younger kids, 5 otherwise", () => {
    const young = buildQuizStartMessages("animals", 6, false);
    const older = buildQuizStartMessages("animals", 9, false);
    expect(young[1].content).toContain("3-question");
    expect(older[1].content).toContain("5-question");
  });
  it("asks for choices in easy mode", () => {
    const msgs = buildQuizStartMessages("animals", 6, true);
    expect(msgs[0].content).toContain("ALWAYS give 3 multiple-choice options");
  });
  it("never uses the word wrong in the system prompt", () => {
    const msgs = buildQuizStartMessages("animals", 6, false);
    expect(msgs[0].content.toLowerCase()).toContain('never use the word "wrong"');
  });
});

describe("buildQuizAnswerMessages", () => {
  it("includes history and gentle-evaluation instructions", () => {
    const msgs = buildQuizAnswerMessages("dinosaurs", 8, false, [
      { question: "What is a T. rex?", correct: true, userAnswer: "t rex" },
    ], "tea rex");
    expect(msgs[1].content).toContain("tea rex");
    expect(msgs[1].content).toContain("accept close answers and mishearings");
  });
});

describe("parseQuizStart", () => {
  it("parses a valid question", () => {
    const q = parseQuizStart(JSON.stringify({
      question: "What says moo?",
      choices: ["Cow", "Duck", "Pig"],
      spoken: "Question 1 of 3. What says moo?",
    }));
    expect(q?.question).toBe("What says moo?");
    expect(q?.choices).toEqual(["Cow", "Duck", "Pig"]);
  });
  it("returns null for malformed output", () => {
    expect(parseQuizStart("not json")).toBeNull();
    expect(parseQuizStart(JSON.stringify({ question: "" }))).toBeNull();
  });
});

describe("parseQuizAnswer", () => {
  it("parses gentle feedback and next question", () => {
    const a = parseQuizAnswer(JSON.stringify({
      correct: true,
      feedback: "Yes! Cows say moo. Great listening!",
      stopRequested: false,
      easyRequested: false,
      next: { question: "What is green?", choices: ["Grass", "Sky"], spoken: "Question 2 of 3." },
      done: false,
    }));
    expect(a?.correct).toBe(true);
    expect(a?.feedback.toLowerCase()).not.toContain("wrong");
    expect(a?.next?.question).toBe("What is green?");
  });
  it("detects stop requests", () => {
    const a = parseQuizAnswer(JSON.stringify({
      correct: false, feedback: "Good try!", stopRequested: true, easyRequested: false, next: null, done: true,
    }));
    expect(a?.stopRequested).toBe(true);
    expect(a?.done).toBe(true);
  });
  it("returns null for garbage", () => {
    expect(parseQuizAnswer("garbage")).toBeNull();
  });
});
