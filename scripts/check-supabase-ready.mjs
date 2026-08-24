import { readFile } from "node:fs/promises";

async function readDotEnv(path) {
  try {
    const content = await readFile(path, "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

const fileEnv = await readDotEnv(".env.local");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tables = [
  "families",
  "parents",
  "children",
  "pets",
  "pet_passports",
  "levels",
  "tasks",
  "chores",
  "task_completions",
  "rewards",
  "stickers",
  "kid_bank_transactions",
  "savings_goals",
  "donations",
  "approvals",
  "memory_moments",
  "badge_awards",
  "neighborhood_jobs",
  "launch_interest_signups",
  "family_account_snapshots",
];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase is not connected. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.");
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL should look like https://your-project-ref.supabase.co.");
}

if (!supabaseAnonKey.startsWith("sb_publishable_") && supabaseAnonKey.length < 80) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY should be the anon public key or the newer sb_publishable key from Supabase API settings.");
}

const headers = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
};

const tableResults = [];
for (const table of tables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers });
  if (response.ok || response.status === 401) {
    tableResults.push({ table, ok: true, status: response.status });
  } else {
    tableResults.push({ table, ok: false, status: response.status, detail: await response.text() });
  }
}

const missingTables = tableResults.filter((result) => !result.ok && result.detail?.includes("PGRST205"));
console.log("TailTots Supabase table check:");
for (const result of tableResults) {
  console.log(`${result.ok ? "OK     " : "MISSING"} ${result.table} (${result.status})`);
}

if (missingTables.length) {
  throw new Error(`Missing ${missingTables.length} TailTots table(s). Run supabase/schema.sql in Supabase SQL Editor.`);
}

const testEmail = `tailtots-check-${Date.now()}@example.com`;
const insertResponse = await fetch(`${supabaseUrl}/rest/v1/launch_interest_signups`, {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: JSON.stringify({
    email: testEmail,
    city: "Test City",
    source: "supabase-readiness-check",
  }),
});

if (!insertResponse.ok) {
  const detail = await insertResponse.text();
  throw new Error(`Example launch-interest insert failed (${insertResponse.status}). Check RLS insert policy. ${detail}`);
}

console.log(`Example insert succeeded: ${testEmail}`);
console.log("Supabase is connected and the TailTots schema is reachable.");
