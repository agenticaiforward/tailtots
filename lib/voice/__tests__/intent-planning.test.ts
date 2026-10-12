import { describe, expect, it } from "vitest";
import {
  buildVoiceIntentMessages,
  parseVoiceIntentResponse,
  validateVoiceIntentInput,
} from "../intent-planning";

const goodContext = {
  role: "child" as const,
  tab: "bank",
  tabLabel: "Kid Bank",
  summary: "Kid Bank: $3 available",
  elements: [
    { label: "$2", kind: "button" as const, group: "How much?" },
    { label: "SAVE jar", kind: "button" as const, group: "Which jar?" },
  ],
};

describe("validateVoiceIntentInput", () => {
  it("accepts a well-formed request", () => {
    const r = validateVoiceIntentInput({
      transcript: "put two dollars in the save jar",
      context: goodContext,
      history: [],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects missing transcript", () => {
    const r = validateVoiceIntentInput({ transcript: "", context: goodContext });
    expect(r.ok).toBe(false);
  });

  it("rejects bad role", () => {
    const r = validateVoiceIntentInput({
      transcript: "hi",
      context: { ...goodContext, role: "admin" },
    });
    expect(r.ok).toBe(false);
  });

  it("caps elements and truncates long labels", () => {
    const elements = Array.from({ length: 100 }, (_, i) => ({
      label: `b${i}` + "x".repeat(200),
      kind: "button" as const,
    }));
    const r = validateVoiceIntentInput({
      transcript: "hi",
      context: { ...goodContext, elements },
      history: ["a".repeat(500)],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.context.elements.length).toBeLessThanOrEqual(40);
      expect(r.value.context.elements[0].label.length).toBeLessThanOrEqual(100);
      expect(r.value.history[0].length).toBeLessThanOrEqual(200);
    }
  });

  it("skips malformed elements instead of failing", () => {
    const r = validateVoiceIntentInput({
      transcript: "hi",
      context: {
        ...goodContext,
        elements: [
          ...goodContext.elements,
          { label: "", kind: "button" } as never,
          null as never,
          42 as never,
        ],
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.context.elements.length).toBe(2); // the 2 good ones
  });
});

describe("buildVoiceIntentMessages", () => {
  it("includes transcript, context, and history", () => {
    const msgs = buildVoiceIntentMessages("save two dollars", goodContext, ["User: hi"]);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toContain("save two dollars");
    expect(msgs[1].content).toContain("SAVE jar");
    expect(msgs[1].content).toContain("User: hi");
    expect(msgs[0].content).toContain("Tolerate misheard words");
  });
});

describe("parseVoiceIntentResponse", () => {
  it("parses a full action plan", () => {
    const plan = parseVoiceIntentResponse(
      '{"reply": "Putting $2 in your SAVE jar.", "clarify": null, "actions": [{"do": "click", "target": "$2"}, {"do": "click", "target": "SAVE jar"}]}'
    );
    expect(plan?.reply).toBe("Putting $2 in your SAVE jar.");
    expect(plan?.clarify).toBeNull();
    expect(plan?.actions).toHaveLength(2);
    expect(plan?.actions[0]).toEqual({ do: "click", target: "$2" });
  });

  it("parses a clarification", () => {
    const plan = parseVoiceIntentResponse(
      '{"reply": "", "clarify": "SAVE jar or SPEND jar?", "actions": []}'
    );
    expect(plan?.clarify).toBe("SAVE jar or SPEND jar?");
    expect(plan?.actions).toHaveLength(0);
  });

  it("extracts JSON from prose", () => {
    const plan = parseVoiceIntentResponse(
      'Here is the plan: {"reply": "Done.", "clarify": null, "actions": []} hope that helps'
    );
    expect(plan?.reply).toBe("Done.");
  });

  it("rejects garbage", () => {
    expect(parseVoiceIntentResponse("not json at all")).toBeNull();
    expect(parseVoiceIntentResponse("")).toBeNull();
  });

  it("drops invalid actions but keeps valid ones", () => {
    const plan = parseVoiceIntentResponse(
      '{"reply": "ok", "clarify": null, "actions": [{"do": "click", "target": "$2"}, {"do": "explode", "target": "x"}, {"do": "click"}]}'
    );
    expect(plan?.actions).toHaveLength(1);
  });

  it("caps actions at 8", () => {
    const actions = Array.from({ length: 20 }, (_, i) => `{"do": "click", "target": "b${i}"}`).join(",");
    const plan = parseVoiceIntentResponse(`{"reply": "ok", "clarify": null, "actions": [${actions}]}`);
    expect(plan?.actions).toHaveLength(8);
  });
});
