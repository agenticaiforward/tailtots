/**
 * Dependency-free validator for the Alexa request envelope.
 *
 * The Lambda is a standalone deployable and cannot import `@/lib`, so this
 * module mirrors `lib/validation/alexa.ts` (zod). Keep the two in sync:
 * both require `request.type`; `request.intent.name` is required only for
 * IntentRequests.
 *
 * @param {unknown} event The raw Lambda event.
 * @returns {{ ok: true, requestType: string, intentName: string | undefined } |
 *           { ok: false, issues: string }}
 */
export function validateAlexaEvent(event) {
  if (event === null || typeof event !== "object") {
    return { ok: false, issues: "event must be an object" };
  }
  const request = event.request;
  if (request === null || typeof request !== "object") {
    return { ok: false, issues: "event.request must be an object" };
  }
  if (typeof request.type !== "string" || request.type.length === 0) {
    return { ok: false, issues: "event.request.type must be a non-empty string" };
  }
  let intentName;
  if (request.type === "IntentRequest") {
    const intent = request.intent;
    if (intent === null || typeof intent !== "object" || typeof intent.name !== "string" || intent.name.length === 0) {
      return { ok: false, issues: "event.request.intent.name must be a non-empty string for IntentRequest" };
    }
    intentName = intent.name;
  }
  return { ok: true, requestType: request.type, intentName };
}
