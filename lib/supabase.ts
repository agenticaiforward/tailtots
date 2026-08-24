import { createClient } from "@supabase/supabase-js";

const runtimeEnv =
  typeof process !== "undefined"
    ? process.env
    : ({} as Record<string, string | undefined>);

const supabaseUrl = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export type LaunchInterestInput = {
  email: string;
  city?: string;
  source?: string;
};

export async function submitLaunchInterest(input: LaunchInterestInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid parent email address.");
  }

  const payload = {
    email: normalizedEmail,
    city: input.city?.trim() || null,
    source: input.source ?? "tailtots-app",
  };

  if (!supabase) {
    const saved = JSON.parse(localStorage.getItem("tailtots-launch-interest") ?? "[]") as typeof payload[];
    localStorage.setItem("tailtots-launch-interest", JSON.stringify([payload, ...saved].slice(0, 50)));
    return { mode: "local" as const };
  }

  const { error } = await supabase.from("launch_interest_signups").insert(payload);
  if (error) throw error;
  return { mode: "cloud" as const };
}

export async function signUpParentAccount(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function signInParentAccount(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function signOutParentAccount() {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function saveFamilyAccountSnapshot(snapshot: unknown) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Sign in before saving this family account.");

  const { error } = await supabase.from("family_account_snapshots").upsert({
    auth_user_id: userData.user.id,
    snapshot,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function loadFamilyAccountSnapshot<TSnapshot>() {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Sign in before loading this family account.");

  const { data, error } = await supabase
    .from("family_account_snapshots")
    .select("snapshot")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.snapshot ?? null) as TSnapshot | null;
}
