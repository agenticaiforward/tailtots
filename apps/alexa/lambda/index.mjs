const demoMissions = [
  "Check food and water with a grown-up nearby.",
  "Help at home, then tell a parent what you finished.",
  "Choose one way to earn, save, contribute, or create today.",
];

export async function handler(event) {
  const request = event?.request ?? {};
  const intentName = request.intent?.name;

  if (request.type === "LaunchRequest") {
    return speak("Welcome to TailTots. Kids grow into the world with parents by their side. You can ask what's next, or start today's mission.");
  }

  if (intentName === "GetTodayMissionsIntent") {
    return speak(`Today's TailTots missions help kids care, connect, earn, contribute, and create. ${demoMissions.join(" ")}`);
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
