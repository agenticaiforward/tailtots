import { describe, expect, it } from "vitest";
import { handler } from "../lambda/index.mjs";
import { validateAlexaEvent } from "../lambda/validate.mjs";

function speech(response) {
  return response?.response?.outputSpeech?.text;
}

function withToken(event, token = "TEST-TOKEN") {
  return {
    ...event,
    session: { ...(event.session ?? {}), user: { ...((event.session ?? {}).user ?? {}), accessToken: token } },
  };
}

const liveSummary = {
  kids: [
    { name: "Aarush", streakDays: 12, bankCents: 1250, savedCents: 800, givenCents: 200 },
    { name: "Sahasra", streakDays: 5, bankCents: 600, savedCents: 350, givenCents: 50 },
  ],
  pendingApprovals: [
    { title: "Feed the dog breakfast", child: "Aarush" },
    { title: "Tidy the living room", child: "Sahasra" },
  ],
  todayMissions: [
    { title: "Feed the dog breakfast", child: "Aarush", state: "awaiting approval" },
    { title: "Brush teeth", child: "Sahasra", state: "not done yet" },
  ],
};

const depsWithSummary = {
  fetchFn: async (url, options) => {
    expect(options.headers.Authorization).toBe("Bearer TEST-TOKEN");
    return { ok: true, json: async () => liveSummary };
  },
};

const depsFailing = {
  fetchFn: async () => ({ ok: false, json: async () => ({ error: "boom" }) }),
};

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

describe("handler — no linked account", () => {
  it("asks to link on launch", async () => {
    const text = speech(await handler({ request: { type: "LaunchRequest" } }));
    expect(text).toContain("Welcome to Tail Tots for Parents");
    expect(text).toContain("link your TailTots parent account");
  });

  it("asks to link for every family-data intent, never demo data", async () => {
    for (const intentName of ["GetTodayMissionsIntent", "PendingApprovalsIntent", "BankBalanceIntent", "StreakStatusIntent"]) {
      const text = speech(await handler({ request: { type: "IntentRequest", intent: { name: intentName } } }));
      expect(text).toContain("link your TailTots parent account");
      expect(text.toLowerCase()).not.toContain("demo");
    }
  });

  it("still answers the pet check without linking", async () => {
    const text = speech(await handler({ request: { type: "IntentRequest", intent: { name: "PetCheckIntent" } } }));
    expect(text).toContain("The TailTots pet check");
  });

  it("mentions linking in help when unlinked", async () => {
    const text = speech(await handler({ request: { type: "IntentRequest", intent: { name: "AMAZON.HelpIntent" } } }));
    expect(text).toContain("link your TailTots account");
  });
});

describe("handler — linked account (live data)", () => {
  it("reports live missions, approvals, bank, and streaks from the summary", async () => {
    const missions = speech(await handler(withToken({ request: { type: "IntentRequest", intent: { name: "GetTodayMissionsIntent" } } }), depsWithSummary));
    expect(missions).toContain("Today's TailTots missions");
    expect(missions).toContain("Feed the dog breakfast, for Aarush");
    expect(missions.toLowerCase()).not.toContain("demo");

    const approvals = speech(await handler(withToken({ request: { type: "IntentRequest", intent: { name: "PendingApprovalsIntent" } } }), depsWithSummary));
    expect(approvals).toContain("2 missions waiting for your approval");
    expect(approvals).toContain("Tidy the living room, completed by Sahasra");

    const bank = speech(await handler(withToken({ request: { type: "IntentRequest", intent: { name: "BankBalanceIntent" } } }), depsWithSummary));
    expect(bank).toContain("Aarush has $12.50 in the Kid Bank");

    const streaks = speech(await handler(withToken({ request: { type: "IntentRequest", intent: { name: "StreakStatusIntent" } } }), depsWithSummary));
    expect(streaks).toContain("Sahasra is on a 5-day streak");
  });

  it("says nothing needs approval when the queue is empty", async () => {
    const deps = {
      fetchFn: async () => ({ ok: true, json: async () => ({ ...liveSummary, pendingApprovals: [] }) }),
    };
    const text = speech(await handler(withToken({ request: { type: "IntentRequest", intent: { name: "PendingApprovalsIntent" } } }), deps));
    expect(text).toContain("Nothing needs your approval right now");
  });

  it("degrades gracefully when the summary fetch fails", async () => {
    const text = speech(await handler(withToken({ request: { type: "IntentRequest", intent: { name: "PendingApprovalsIntent" } } }), depsFailing));
    expect(text).toContain("couldn't reach your family's TailTots data");
    expect(text.toLowerCase()).not.toContain("demo");
  });
});

describe("handler — session handling", () => {
  it("helps, stops, and closes gracefully", async () => {
    expect(
      speech(await handler(withToken({ request: { type: "IntentRequest", intent: { name: "AMAZON.HelpIntent" } } }), depsWithSummary)),
    ).toContain("what needs my approval");
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
