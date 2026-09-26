/**
 * Supabase client singleton.
 *
 * Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
 * read here — both are public by design (the anon key is safe to ship in
 * the client bundle; row-level security enforces access). The service-role
 * key must NEVER be referenced in app code; it is server/scripts only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnv(name: string): string | undefined {
  // Vite/Next client bundle path.
  const fromImportMeta =
    typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name]
      : undefined;
  // SSR / script path.
  const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return fromImportMeta ?? fromProcess;
}

const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
