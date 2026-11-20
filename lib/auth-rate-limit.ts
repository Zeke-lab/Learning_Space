import { createHmac } from "node:crypto";
import type { Transaction } from "./account-service.ts";

export function createAuthLimiter(transaction: Transaction, secret: string) {
  return async (action: string, identity: string, limit: number, minutes = 15) => {
    const bucket = createHmac("sha256", secret).update(`${action}:${identity}`).digest("hex");
    return transaction(async client => {
      // Atomic across instances. Only keyed digests are retained, never raw identities.
      const result = await client.query(`INSERT INTO learning_space_auth.rate_limits(bucket,hits,expires_at)
        VALUES ($1,1,now()+($2 * interval '1 minute')) ON CONFLICT (bucket) DO UPDATE
        SET hits=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.hits+1 END,
            expires_at=CASE WHEN rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END
        RETURNING hits`, [bucket,minutes]);
      await client.query(`DELETE FROM learning_space_auth.rate_limits WHERE bucket IN
        (SELECT bucket FROM learning_space_auth.rate_limits WHERE expires_at<now() LIMIT 100)`);
      return result.rows[0].hits <= limit;
    });
  };
}
