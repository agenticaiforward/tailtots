import { describe, expect, it } from "vitest";
import { parseVoiceIntent } from "../intent-local";

describe("parseVoiceIntent — kid loop (Oct 14 voice-everywhere pass)", () => {
  it("hears today's missions", () => {
    expect(parseVoiceIntent("what are my missions")).toEqual({ type: "read-missions" });
    expect(parseVoiceIntent("read my missions")).toEqual({ type: "read-missions" });
    expect(parseVoiceIntent("what do I do today")).toEqual({ type: "read-missions" });
    expect(parseVoiceIntent("my missions")).toEqual({ type: "read-missions" });
  });

  it("hears the points balance", () => {
    expect(parseVoiceIntent("how many points do I have")).toEqual({ type: "read-balance" });
    expect(parseVoiceIntent("my points")).toEqual({ type: "read-balance" });
  });

  it("hears points news", () => {
    expect(parseVoiceIntent("any news")).toEqual({ type: "read-news" });
    expect(parseVoiceIntent("what's new")).toEqual({ type: "read-news" });
  });

  it("the natural completion phrases all mean complete-mission", () => {
    for (const phrase of ["I did it", "mission done", "I'm done", "all done", "done", "did it"]) {
      expect(parseVoiceIntent(phrase)).toEqual({ type: "complete-mission", query: "" });
    }
  });

  it("named completion keeps the name for resolution", () => {
    expect(parseVoiceIntent("mark feed the dog done")).toEqual({
      type: "complete-mission",
      query: "feed the dog",
    });
  });

  it("jar allocation parses amount + jar", () => {
    expect(parseVoiceIntent("put $2 in the save jar")).toEqual({
      type: "allocate-jar",
      jar: "save",
      amount: 2,
    });
    expect(parseVoiceIntent("move 5 dollars to give")).toEqual({
      type: "allocate-jar",
      jar: "give",
      amount: 5,
    });
    expect(parseVoiceIntent("put 3 in spend jar")).toEqual({
      type: "allocate-jar",
      jar: "spend",
      amount: 3,
    });
  });

  it("parent approval parses with and without a name", () => {
    expect(parseVoiceIntent("approve")).toEqual({ type: "approve-mission", query: "" });
    expect(parseVoiceIntent("approve feed the dog")).toEqual({
      type: "approve-mission",
      query: "feed the dog",
    });
  });
});

describe("parseVoiceIntent — regressions from the original parser", () => {
  it("navigation still works", () => {
    expect(parseVoiceIntent("go to missions")).toEqual({ type: "navigate", tab: "missions" });
    expect(parseVoiceIntent("open the bank")).toEqual({ type: "navigate", tab: "bank" });
  });

  it("book logging still works and is not stolen by completion", () => {
    expect(parseVoiceIntent("I read Harry Potter")).toEqual({ type: "log-book", title: "Harry Potter" });
    expect(parseVoiceIntent("I finished reading Dune")).toEqual({ type: "log-book", title: "Dune" });
  });

  it("chore logging still works", () => {
    const a = parseVoiceIntent("I did the dishes chore");
    expect(a.type).toBe("log-chore");
  });

  it("read page still works", () => {
    expect(parseVoiceIntent("read this page")).toEqual({ type: "read-page" });
  });

  it("click still works", () => {
    expect(parseVoiceIntent("click the approve button")).toEqual({ type: "click", label: "approve" });
  });

  it("unknown stays unknown", () => {
    expect(parseVoiceIntent("flibberty gibbet")).toEqual({ type: "unknown", text: "flibberty gibbet" });
  });
});
