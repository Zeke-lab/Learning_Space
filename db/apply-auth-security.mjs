import { readFile } from "node:fs/promises";
import pg from "pg";
import { connectionConfig, supabaseUrl } from "./supabase-config.mjs";

process.loadEnvFile(".env.local");
const client = new pg.Client(connectionConfig(supabaseUrl("postgres", process.env.SUPABASE_DB_PASSWORD), "postgres"));
try {
  await client.connect();
  const existing = (await client.query("SELECT to_regclass('learning_space_auth.rate_limits') AS table_name")).rows[0].table_name;
  if (!existing) await client.query(await readFile(new URL("./migrations/003_auth_rate_limits.sql", import.meta.url), "utf8"));
  const checks = await client.query(`SELECT has_table_privilege('learning_space_authenticator','learning_space_auth.rate_limits','SELECT,INSERT,UPDATE,DELETE') AS auth_access,
    has_table_privilege('learning_space_app','learning_space_auth.rate_limits','SELECT') AS content_access,
    has_table_privilege('anon','learning_space_auth.rate_limits','SELECT') AS anonymous_access`);
  if (!checks.rows[0].auth_access || checks.rows[0].content_access || checks.rows[0].anonymous_access) throw new Error("Unexpected privileges");
  console.log("Authentication rate-limit migration installed; private role access verified. No account records changed.");
} catch {
  console.error("Authentication migration failed. Check the private owner connection and schema state.");
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
