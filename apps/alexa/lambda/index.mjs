/**
 * TailTots for Parents — Alexa skill lambda (REAL data).
 *
 * Parent-facing companion: today's missions, pending approvals, Kid Bank
 * balances, and streaks — all from the family's LIVE TailTots data via the
 * account-linked access token (event.session.user.accessToken).
 *
 * With no linked account, every family-data intent asks the user to link
 * their TailTots account in the Alexa app. No demo data is ever served.
 * The pet check is static educational content and works without linking.
 *
 * Env:
 *   TAILTOTS_API_URL — worker origin, e.g. https://tailtots.com
 *     (defaults to https://tailtots.com)
 *
 * OAuth endpoints on the worker:
 *   GET  /oauth/alexa/authorize (parent Supabase session -> code -> 302)
 *   POST /oauth/alexa/token     (code + client credentials -> access token)
 *   GET  /api/alexa/family-summary (Bearer access token -> live family data)
 */

const API_BASE = (process.env.TAILTOTS_API_URL || "https://tailtots.com").replace(/\/+$/, "");
const SUMMARY_URL = `${API_BASE}/api/alexa/family-summary`;

const dollars = (cents) => `$${(Number(cents) / 100).toFixed(2)}`;

function speak(text, { endSession = true, reprompt = null } = {}) {
  const response = {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text },
      shouldEndSession: endSession,
    },
  };
  if (reprompt) {
    response.response.reprompt = { outputSpeech: { type: "PlainText", text: reprompt } };
  }
  return response;
}

const LINK_PROMPT = {
  text: "To use TailTots on Alexa, link your TailTots parent account first. Open the Alexa app, find TailTots for Parents, and choose Link account. What would you like to do once that's set up?",
  reprompt: "Link your TailTots account in the Alexa app, then come back and ask what's on today's missions.",
};

function askToLink() {
  return speak(LINK_PROMPT.text, { endSession: false, reprompt: LINK_PROMPT.reprompt });
}

/**
 * Fetch the family's live summary. `fetchFn` is injected in tests.
 */
export async function fetchFamilySummary(accessToken, { fetchFn = fetch, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(SUMMARY_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function todayMissionsText(summary) {
  const missions = summary.todayMissions ?? [];
  if (!missions.length) {
    return "There are no missions on today's TailTots list. Enjoy the quiet day — or add one in the app.";
  }
  const lines = missions.slice(0, 8).map((m) => `${m.title}, for ${m.child}: ${m.state}.`);
  return `Today's TailTots missions. ${lines.join(" ")}`;
}

function pendingApprovalsText(summary) {
  const pending = summary.pendingApprovals ?? [];
  if (!pending.length) {
    return "Nothing needs your approval right now. Nice — the kids are either done or still working.";
  }
  const lines = pending.map((m) => `${m.title}, completed by ${m.child}.`);
  return (
    `You have ${pending.length} ${pending.length === 1 ? "mission" : "missions"} waiting for your approval, ` +
    `about 30 seconds each. ${lines.join(" ")} Open the TailTots app to approve them and keep the streaks alive.`
  );
}

function bankBalanceText(summary) {
  const kids = summary.kids ?? [];
  if (!kids.length) {
    return "Your TailTots account doesn't have any kids set up yet. Add a kid profile in the app first.";
  }
  const lines = kids.map(
    (c) => `${c.name} has ${dollars(c.bankCents)} in the Kid Bank, with ${dollars(c.savedCents)} saved and ${dollars(c.givenCents)} given to good causes.`,
  );
  return `Kid Bank balances. ${lines.join(" ")}`;
}

function streakStatusText(summary) {
  const kids = summary.kids ?? [];
  if (!kids.length) {
    return "Your TailTots account doesn't have any kids set up yet. Add a kid profile in the app first.";
  }
  const lines = kids.map((c) => `${c.name} is on a ${c.streakDays}-day streak.`);
  return `Streak check. ${lines.join(" ")} Consistency is the whole game — every approved day keeps it going.`;
}

function petCheckText() {
  return (
    "The TailTots pet check: fresh food, clean water, and a comfort check — " +
    "clean space, gentle hands, calm voice. When your child finishes, " +
    "they'll mark it done and you'll approve it in about 30 seconds."
  );
}

export async function handler(event, deps = {}) {
  const request = event?.request ?? {};
  const intentName = request.intent?.name;
  const accessToken = event?.session?.user?.accessToken ?? null;

  if (request.type === "LaunchRequest") {
    if (!accessToken) {
      return speak(
        "Welcome to Tail Tots for Parents. " + LINK_PROMPT.text,
        { endSession: false, reprompt: LINK_PROMPT.reprompt },
      );
    }
    return speak(
      "Welcome to Tail Tots for Parents. You can ask: what needs my approval, what are today's missions, " +
        "kid bank balance, or how are the streaks. What would you like to hear?",
      { endSession: false, reprompt: "You can ask what needs your approval, or for today's missions." },
    );
  }

  // Static educational content — works without account linking.
  if (intentName === "PetCheckIntent") {
    return speak(petCheckText());
  }

  const needsSummary = new Set([
    "GetTodayMissionsIntent",
    "PendingApprovalsIntent",
    "BankBalanceIntent",
    "StreakStatusIntent",
  ]);

  if (needsSummary.has(intentName)) {
    if (!accessToken) return askToLink();
    const summary = await fetchFamilySummary(accessToken, deps);
    if (!summary) {
      return speak(
        "I couldn't reach your family's TailTots data just now. Check that your account is still linked in the Alexa app, then try again.",
      );
    }
    switch (intentName) {
      case "GetTodayMissionsIntent":
        return speak(todayMissionsText(summary));
      case "PendingApprovalsIntent":
        return speak(pendingApprovalsText(summary));
      case "BankBalanceIntent":
        return speak(bankBalanceText(summary));
      case "StreakStatusIntent":
        return speak(streakStatusText(summary));
    }
  }

  switch (intentName) {
    case "AMAZON.HelpIntent":
      return speak(
        "Try: what needs my approval, what are today's missions, kid bank balance, or how are the streaks. " +
          (accessToken ? "" : "First, link your TailTots account in the Alexa app."),
        { endSession: false },
      );
    case "AMAZON.CancelIntent":
    case "AMAZON.StopIntent":
      return speak("Okay, TailTots is closing. Nice work staying in the loop.");
    default:
      return speak("I didn't catch that. You can ask what needs your approval, or for today's missions.", { endSession: false });
  }
}
