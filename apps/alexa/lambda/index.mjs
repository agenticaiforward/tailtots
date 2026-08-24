const demoMissions = [
  "Check food and water with a grown-up nearby.",
  "Look for one comfort clue: calm body, clean space, or fresh hay.",
  "Tell a parent what you noticed so they can approve the mission.",
];

export async function handler(event) {
  const request = event?.request ?? {};
  const intentName = request.intent?.name;

  if (request.type === "LaunchRequest") {
    return speak("Welcome to TailTots. You can ask what's next, or start a pet check.");
  }

  if (intentName === "GetTodayMissionsIntent") {
    return speak(`Today's TailTots missions are: ${demoMissions.join(" ")}`);
  }

  if (intentName === "PetCheckIntent") {
    return speak("Start with food, water, and comfort. Use gentle hands, then ask a parent to approve what you finished.");
  }

  if (intentName === "AMAZON.HelpIntent") {
    return speak("Try saying, what's next, or, start a pet check.");
  }

  return speak("Okay, TailTots is closing. Nice work caring for your pets.");
}

function speak(outputSpeech) {
  return {
    version: "1.0",
    response: {
      outputSpeech: {
        type: "PlainText",
        text: outputSpeech,
      },
      shouldEndSession: true,
    },
  };
}
