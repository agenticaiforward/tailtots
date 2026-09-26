/**
 * Parent authentication data access.
 *
 * UI layers use these helpers instead of touching the Supabase client
 * directly, so auth behavior and error mapping stay in one place.
 */
import { AppError, ErrorCode, authRequiredError, notConfiguredError, toUserMessage } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/logging/logger";
import { parentAuthSchema } from "@/lib/validation/inputs";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client";

const log = createLogger("data:auth");
const NOT_READY_MESSAGE = "Parent accounts are being prepared. Please try the demo for now.";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw notConfiguredError(NOT_READY_MESSAGE);
  return client;
}

export function isAuthConfigured(): boolean {
  return isSupabaseConfigured;
}

export async function getAuthSession() {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    log.error("getAuthSession failed", { error });
    throw new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
  }
  return data.session;
}

export function subscribeToAuthChanges(callback: (session: Awaited<ReturnType<typeof getAuthSession>>) => void) {
  const client = requireClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function getCurrentUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    log.error("getCurrentUser failed", { error });
    throw new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
  }
  return data.user;
}

export async function signUpParentAccount(email: string, password: string) {
  const parsed = parentAuthSchema.safeParse({ email, password });
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, parsed.error.issues[0]?.message ?? "Check your email and password.");
  }
  const client = requireClient();
  const { data, error } = await client.auth.signUp({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    log.warn("signUpParentAccount failed", { error });
    throw new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
  }
  return data.user;
}

export async function signInParentAccount(email: string, password: string) {
  const parsed = parentAuthSchema.safeParse({ email, password });
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, parsed.error.issues[0]?.message ?? "Check your email and password.");
  }
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    log.warn("signInParentAccount failed", { error });
    throw new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
  }
  return data.user;
}

export async function signOutParentAccount(): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) {
    log.error("signOutParentAccount failed", { error });
    throw new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw authRequiredError();
  return user;
}
