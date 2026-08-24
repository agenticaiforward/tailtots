import { readFile } from "node:fs/promises";

const jsonFiles = [
  "apps/alexa/skill-package/skill.json",
  "apps/alexa/skill-package/interactionModels/custom/en-US.json",
];

for (const file of jsonFiles) {
  JSON.parse(await readFile(file, "utf8"));
}

const lambda = await import("./lambda/index.mjs");
if (typeof lambda.handler !== "function") {
  throw new Error("Alexa lambda handler export is missing.");
}

const launchResponse = await lambda.handler({ request: { type: "LaunchRequest" } });
if (!launchResponse?.response?.outputSpeech?.text) {
  throw new Error("Alexa launch response is missing speech text.");
}

console.log("Alexa skill package JSON and lambda smoke test passed.");
