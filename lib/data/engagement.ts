/**
 * Launch-list and website-feedback data access.
 *
 * When Supabase is not configured, submissions queue in localStorage so the
 * demo keeps working offline. Queued items are validated on read; corrupt
 * entries are dropped instead of crashing the app.
 */
import { AppError, ErrorCode, toUserMessage } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/logging/logger";
import {
  feedbackSchema,
  launchInterestSchema,
  type FeedbackInput,
  type LaunchInterestInput,
} from "@/lib/validation/inputs";
import { getSupabaseClient } from "./supabase-client";

const log = createLogger("data:engagement");
const LAUNCH_QUEUE_KEY = "tailtots-launch-interest";
const FEEDBACK_QUEUE_KEY = "tailtots-feedback";
const MAX_QUEUED = 50;

function readQueue<T>(key: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: T[] = [];
    for (const item of parsed) {
      const result = schema.safeParse(item);
      if (result.success && result.data !== undefined) valid.push(result.data);
    }
    return valid;
  } catch (error) {
    log.warn("Dropping unreadable local queue", { key, error });
    return [];
  }
}

function writeQueue<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_QUEUED)));
  } catch (error) {
    log.warn("Could not persist local queue", { key, error });
    throw new AppError(ErrorCode.STORAGE, "Could not save on this device. Please try again.", { cause: error });
  }
}

export type SubmitMode = "local" | "cloud";

export async function submitLaunchInterest(input: LaunchInterestInput): Promise<{ mode: SubmitMode }> {
  const parsed = launchInterestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, parsed.error.issues[0]?.message ?? "Enter a valid parent email address.");
  }
  const payload = { email: parsed.data.email, city: parsed.data.city, source: parsed.data.source };

  const client = getSupabaseClient();
  if (!client) {
    writeQueue(LAUNCH_QUEUE_KEY, [payload, ...readQueue(LAUNCH_QUEUE_KEY, launchInterestSchema)]);
    return { mode: "local" };
  }
  const { error } = await client.from("launch_interest_signups").insert(payload);
  if (error) {
    log.error("submitLaunchInterest failed", { error });
    throw new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
  }
  return { mode: "cloud" };
}

export async function submitFeedback(input: FeedbackInput): Promise<{ mode: SubmitMode }> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, parsed.error.issues[0]?.message ?? "Write a short question or feedback note first.");
  }
  const payload = { email: parsed.data.email, message: parsed.data.message, source: parsed.data.source };

  const client = getSupabaseClient();
  if (!client) {
    writeQueue(FEEDBACK_QUEUE_KEY, [payload, ...readQueue(FEEDBACK_QUEUE_KEY, feedbackSchema)]);
    return { mode: "local" };
  }
  const { error } = await client.from("website_feedback").insert(payload);
  if (error) {
    log.error("submitFeedback failed", { error });
    throw new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
  }
  return { mode: "cloud" };
}
