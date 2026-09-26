/**
 * TailTots for Parents — Alexa skill lambda.
 *
 * Parent-facing companion: today's missions, pending approvals, Kid Bank
 * balances, streaks, and the pet-care routine. MVP serves clearly-labeled
 * demo family data; account linking with the family's real TailTots data
 * is the next milestone (see skill.json testingInstructions).
 */

// Demo family data — replaced by account-linked data after account linking ships.
const demoFamily = {
  children: [
    { name: "Maya", streakDays: 12, bankCents: 1250, savedCents: 800, givenCents: 200 },
    { name: "Leo", streakDays: 5, bankCents: 600, savedCents: 350, givenCents: 50 },
  ],
  missions: [
    { title: "Feed the guinea pigs", child: "Maya", state: "awaiting approval" },
    { title: "Refill the water bottle", child: "Maya", state: "awaiting approval" },
    { title: "Tidy the hutch", child: "Leo", state: "not done yet" },
    { title: "Ten minutes of reading", child: "Leo", state: "not done yet" },
  ],
};

const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;

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

function launchText() {
  return (
    "Welcome to Tail Tots for Parents. Using demo family data for now. " +
    "You can ask: what needs my approval, what are today's missions, " +
    "kid bank balance, or how are the streaks. What would you like to hear?"
  );
}

function todayMissionsText() {
  const lines = demoFamily.missions.map((m) => `${m.title}, for ${m.child}: ${m.state}.`);
  return `Today's TailTots missions, using demo data. ${lines.join(" ")}`;
}

function pendingApprovalsText() {
  const pending = demoFamily.missions.filter((m) => m.state === "awaiting approval");
  if (!pending.length) {
    return "Nothing needs your approval right now. Nice — the kids are either done or still working.";
  }
  const lines = pending.map((m) => `${m.title}, completed by ${m.child}.`);
  return (
    `You have ${pending.length} ${pending.length === 1 ? "mission" : "missions"} waiting for your approval, ` +
    `about 30 seconds each. ${lines.join(" ")} Open the TailTots app to approve them and keep the streaks alive.`
  );
}

function bankBalanceText() {
  const lines = demoFamily.children.map(
    (c) => `${c.name} has ${dollars(c.bankCents)} in the Kid Bank, with ${dollars(c.savedCents)} saved and ${dollars(c.givenCents)} given to good causes.`,
  );
  return `Kid Bank balances, using demo data. ${lines.join(" ")}`;
}

function streakStatusText() {
  const lines = demoFamily.children.map(
    (c) => `${c.name} is on a ${c.streakDays}-day streak.`,
  );
  return `Streak check, using demo data. ${lines.join(" ")} Consistency is the whole game — every approved day keeps it going.`;
}

function petCheckText() {
  return (
    "The TailTots pet check: fresh food, clean water, and a comfort check — " +
    "clean space, gentle hands, calm voice. When your child finishes, " +
    "they'll mark it done and you'll approve it in about 30 seconds."
  );
}

export async function handler(event) {
  const request = event?.request ?? {};
  const intentName = request.intent?.name;

  if (request.type === "LaunchRequest") {
    return speak(launchText(), { endSession: false, reprompt: "You can ask what needs your approval, or for today's missions." });
  }

  switch (intentName) {
    case "GetTodayMissionsIntent":
      return speak(todayMissionsText());
    case "PendingApprovalsIntent":
      return speak(pendingApprovalsText());
    case "PetCheckIntent":
      return speak(petCheckText());
    case "BankBalanceIntent":
      return speak(bankBalanceText());
    case "StreakStatusIntent":
      return speak(streakStatusText());
    case "AMAZON.HelpIntent":
      return speak(
        "Try: what needs my approval, what are today's missions, kid bank balance, or how are the streaks.",
        { endSession: false },
      );
    case "AMAZON.CancelIntent":
    case "AMAZON.StopIntent":
      return speak("Okay, TailTots is closing. Nice work staying in the loop.");
    default:
      return speak("I didn't catch that. You can ask what needs your approval, or for today's missions.", { endSession: false });
  }
}
