import "server-only";
import { Pool } from "pg";
import { connectionConfig } from "../db/supabase-config.mjs";
import { createAccountService, type Transaction } from "./account-service";
import { sendAuthEmail } from "./auth-email";
import { createAuthLimiter } from "./auth-rate-limit";

let pool: Pool | undefined;
export function databaseAuthConfigured() { return Boolean(process.env.DATABASE_AUTH_URL?.trim()); }
function getPool() {
  if (!pool) pool = new Pool({ ...connectionConfig(process.env.DATABASE_AUTH_URL, "learning_space_authenticator"),
    max: 3, idleTimeoutMillis: 10000, application_name: "LearningSpace:authentication" });
  return pool;
}
const transaction: Transaction = async run => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
};
let service: ReturnType<typeof createAccountService> | undefined;
export function accounts() { return service ??= createAccountService(transaction, sendAuthEmail); }

export async function authRateLimit(action: string, identity: string, limit: number, minutes = 15) {
  return createAuthLimiter(transaction, process.env.NEXTAUTH_SECRET!)(action, identity, limit, minutes);
}
