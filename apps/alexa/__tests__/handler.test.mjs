import { describe, expect, it } from "vitest";
import { handler } from "../lambda/index.mjs";
import { validateAlexaEvent } from "../lambda/validate.mjs";

function speech(response) {
  return response?.response?.outputSpeech?.text;
}

describe("validateAlexaEvent", () => {
  it("accepts launch and intent requests", () => {
    expect(validateAlexaEvent({ request: { type: "LaunchRequest" } }).ok).toBe(true);
    const parsed = validateAlexaEvent({ request: { type: "IntentRequest", intent: { name: "PetCheckIntent" } } });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.intentName).toBe("PetCheckIntent");
  });

  it("rejects malformed events without throwing", () => {
    expect(validateAlexaEvent(null).ok).toBe(false);
    expect(validateAlexaEvent({}).ok).toBe(false);
    expect(validateAlexaEvent({ request: { type: "IntentRequest" } }).ok).toBe(false);
  });
});

describe("handler", () => {
  it("welcomes on launch", async () => {
    const text = speech(await handler({ request: { type: "LaunchRequest" } }));
    expect(text).toContain("Welcome to Tail Tots for Parents");
  });

  it("answers today's missions and the pet check", async () => {
    const missions = speech(await handler({ request: { type: "IntentRequest", intent: { name: "GetTodayMissionsIntent" } } }));
    expect(missions).toContain("Today's TailTots missions, using demo data");
    const petCheck = speech(await handler({ request: { type: "IntentRequest", intent: { name: "PetCheckIntent" } } }));
    expect(petCheck).toContain("The TailTots pet check");
  });

  it("reports pending approvals, bank balances, and streaks", async () => {
    expect(speech(await handler({ request: { type: "IntentRequest", intent: { name: "PendingApprovalsIntent" } } }))).toContain(
      "waiting for your approval",
    );
    expect(speech(await handler({ request: { type: "IntentRequest", intent: { name: "BankBalanceIntent" } } }))).toContain(
      "Kid Bank balances, using demo data",
    );
    expect(speech(await handler({ request: { type: "IntentRequest", intent: { name: "StreakStatusIntent" } } }))).toContain(
      "Streak check, using demo data",
    );
  });

  it("helps, stops, and closes gracefully", async () => {
    expect(speech(await handler({ request: { type: "IntentRequest", intent: { name: "AMAZON.HelpIntent" } } }))).toContain(
      "what needs my approval",
    );
    expect(
      speech(await handler({ request: { type: "IntentRequest", intent: { name: "AMAZON.StopIntent" } } })),
    ).toContain("Nice work");
  });

  it("degrades safely on unknown intents and malformed events", async () => {
    expect(speech(await handler({ request: { type: "IntentRequest", intent: { name: "NopeIntent" } } }))).toContain(
      "I didn't catch that",
    );
    const invalid = speech(await handler(null));
    expect(typeof invalid).toBe("string");
    expect(invalid.length).toBeGreaterThan(0);
  });

  it("always returns a well-formed Alexa envelope", async () => {
    const response = await handler({ request: { type: "LaunchRequest" } });
    expect(response.version).toBe("1.0");
    expect(response.response.outputSpeech.type).toBe("PlainText");
    expect(typeof response.response.shouldEndSession).toBe("boolean");
  });
});
