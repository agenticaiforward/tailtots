import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set DATABASE_URL to the Supabase Postgres connection string.");
}

const schema = await readFile("supabase/schema.sql", "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(schema);
  console.log("TailTots Supabase schema applied.");
} finally {
  await client.end();
}
