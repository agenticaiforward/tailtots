import { describe, expect, it } from "vitest";
import { parseFreeDates, presetLabel } from "../playdate-voice";

describe("parseFreeDates", () => {
  it("maps Saturday morning to sat-am", () => {
    expect(parseFreeDates("Saturday morning works for us")).toEqual(["sat-am"]);
  });

  it("maps Sunday afternoon to sun-pm", () => {
    expect(parseFreeDates("Sunday afternoon")).toEqual(["sun-pm"]);
  });

  it("handles a bare day by offering both windows", () => {
    expect(parseFreeDates("Saturday")).toEqual(["sat-am", "sat-pm"]);
  });

  it("parses mixed day+time utterances in mention order", () => {
    expect(parseFreeDates("Saturday morning and Sunday afternoon")).toEqual(["sat-am", "sun-pm"]);
  });

  it("maps weekdays and after school to weekday-pm", () => {
    expect(parseFreeDates("weekday evenings after school")).toEqual(["weekday-pm"]);
    expect(parseFreeDates("Tuesday")).toEqual(["weekday-pm"]);
  });

  it("maps a bare weekend to the weekend windows", () => {
    expect(parseFreeDates("any time this weekend")).toEqual(["sat-am", "sat-pm", "sun-am"]);
  });

  it("caps at 3 presets and dedupes", () => {
    expect(parseFreeDates("Saturday and Sunday morning and Saturday morning")).toEqual([
      "sat-am",
      "sat-pm",
      "sun-am",
    ]);
  });

  it("returns [] when nothing matches", () => {
    expect(parseFreeDates("umm, let me think")).toEqual([]);
    expect(parseFreeDates("")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(parseFreeDates("SATURDAY MORNING")).toEqual(["sat-am"]);
  });
});

describe("presetLabel", () => {
  it("labels every preset", () => {
    expect(presetLabel("sat-am")).toBe("Sat 10am–12pm");
    expect(presetLabel("weekday-pm")).toBe("Weekday 4–6pm");
  });
});
