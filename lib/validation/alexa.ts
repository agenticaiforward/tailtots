/**
 * Zod schema for the Alexa request envelope.
 *
 * The Lambda is a standalone deployable (it cannot import `@/lib`), so
 * `apps/alexa/lambda/validate.mjs` carries a dependency-free validator that
 * mirrors this schema. Keep the two in sync.
 */
import { z } from "zod";

const alexaIntentSchema = z.object({
  name: z.string().min(1).max(128),
  slots: z.record(z.string(), z.unknown()).optional(),
});

const alexaRequestSchema = z
  .object({
    type: z.string().min(1).max(64),
    intent: alexaIntentSchema.optional(),
  })
  .superRefine((request, ctx) => {
    // Per the Alexa contract, an IntentRequest always names the intent.
    if (request.type === "IntentRequest" && !request.intent?.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "intent.name is required for IntentRequest",
        path: ["intent", "name"],
      });
    }
  });

export const alexaEventSchema = z.object({
  version: z.string().optional(),
  session: z
    .object({
      new: z.boolean().optional(),
      sessionId: z.string().optional(),
      attributes: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  request: alexaRequestSchema,
});

export type AlexaEvent = z.infer<typeof alexaEventSchema>;

export function safeParseAlexaEvent(value: unknown):
  | { ok: true; event: AlexaEvent }
  | { ok: false; issues: string } {
  const result = alexaEventSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, event: result.data };
}
