import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { checkPassword, digestToken, hashPassword, newChallenge } from "./password-security.ts";

export type Transaction = <T>(run: (client: Pick<PoolClient, "query">) => Promise<T>) => Promise<T>;
export type Mail = { email: string; purpose: "verify_email" | "reset_password"; token: string; id: string };
export type Account = { id: string; email: string; name: string | null; sessionVersion: number };
type Credential = { user_id: string; login_email: string; password_hash: string; credential_revision: number; email_verified_at: Date | null };
type Profile = { id: string; email: string; name: string | null; session_version: number; disabled_at: Date | null };

export function createAccountService(transaction: Transaction, sendMail: (mail: Mail) => Promise<void>) {
  async function context(client: Pick<PoolClient, "query">, id: string) {
    await client.query("SELECT set_config('app.user_id', $1, true)", [id]);
  }
  async function profile(client: Pick<PoolClient, "query">, id: string): Promise<Account | null> {
    await context(client, id);
    const user = (await client.query<Profile>("SELECT id,email,name,session_version,disabled_at FROM learning_space.users WHERE id=$1", [id])).rows[0];
    return user && !user.disabled_at ? { id: user.id, email: user.email, name: user.name, sessionVersion: user.session_version } : null;
  }
  async function challenge(client: Pick<PoolClient, "query">, credential: Credential, purpose: Mail["purpose"]) {
    const { token, digest } = newChallenge();
    const id = randomUUID();
    await client.query(`INSERT INTO learning_space_auth.email_challenges
      (id,user_id,purpose,token_digest,login_email,credential_revision,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,now() + ($7 * interval '1 minute'))`,
    [id, credential.user_id, purpose, digest, credential.login_email, credential.credential_revision, purpose === "verify_email" ? 60 : 20]);
    return { id, email: credential.login_email, purpose, token };
  }
  async function deliver(mail: Mail | null) {
    if (!mail) return;
    try { await sendMail(mail); } catch {
      await transaction(async client => { await client.query("DELETE FROM learning_space_auth.email_challenges WHERE id=$1", [mail.id]); });
      throw new Error("Email delivery unavailable");
    }
  }
  // Constant work for unknown users; generated once per process, never an actual credential.
  const dummyHash = hashPassword(randomUUID());
  return {
    async google(subject: string, email: string, name: string | null) {
      return transaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`google:${subject}`]);
        let id = (await client.query<{ user_id: string }>("SELECT user_id FROM learning_space_auth.identities WHERE provider='google' AND provider_subject=$1", [subject])).rows[0]?.user_id;
        if (!id) {
          id = randomUUID();
          await context(client, id);
          await client.query("INSERT INTO learning_space.users(id,email,name,email_verified_at) VALUES ($1,$2,$3,now())", [id,email,name]);
          await client.query("INSERT INTO learning_space_auth.identities(user_id,provider,provider_subject) VALUES ($1,'google',$2)", [id,subject]);
        } else {
          await context(client, id);
          await client.query("UPDATE learning_space.users SET email=$2,name=$3,email_verified_at=now() WHERE id=$1 AND disabled_at IS NULL", [id,email,name]);
        }
        // Never link accounts based only on matching email addresses.
        return profile(client, id);
      });
    },
    async register(name: string, email: string, password: string) {
      const passwordHash = await hashPassword(password);
      const mail = await transaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`email:${email}`]);
        let credential = (await client.query<Credential>("SELECT * FROM learning_space_auth.password_credentials WHERE login_email=$1 FOR UPDATE", [email])).rows[0];
        if (!credential) {
          const id = randomUUID();
          await context(client, id);
          await client.query("INSERT INTO learning_space.users(id,email,name) VALUES ($1,$2,$3)", [id,email,name]);
          credential = (await client.query<Credential>(`INSERT INTO learning_space_auth.password_credentials(user_id,login_email,password_hash)
            VALUES ($1,$2,$3) RETURNING *`, [id,email,passwordHash])).rows[0];
        }
        if (!await profile(client, credential.user_id) || credential.email_verified_at) return null;
        // An anonymous repeat registration cannot replace an existing password or name.
        return challenge(client, credential, "verify_email");
      });
      await deliver(mail);
    },
    async requestEmail(email: string, purpose: Mail["purpose"]) {
      const mail = await transaction(async client => {
        const credential = (await client.query<Credential>("SELECT * FROM learning_space_auth.password_credentials WHERE login_email=$1 FOR UPDATE", [email])).rows[0];
        if (!credential || !await profile(client, credential.user_id)) return null;
        if ((purpose === "verify_email") === Boolean(credential.email_verified_at)) return null;
        return challenge(client, credential, purpose);
      });
      await deliver(mail);
    },
    async login(email: string, password: string) {
      return transaction(async client => {
        const credential = (await client.query<Credential>("SELECT * FROM learning_space_auth.password_credentials WHERE login_email=$1 FOR SHARE", [email])).rows[0];
        const valid = await checkPassword(credential?.password_hash ?? await dummyHash, password);
        if (!valid || !credential?.email_verified_at) return null;
        return profile(client, credential.user_id);
      });
    },
    async consume(token: string, purpose: Mail["purpose"], password: string) {
      const replacementHash = purpose === "reset_password" ? await hashPassword(password) : null;
      return transaction(async client => {
        const credential = (await client.query<Credential & { challenge_id: string }>(`SELECT p.*,c.id AS challenge_id
          FROM learning_space_auth.email_challenges c JOIN learning_space_auth.password_credentials p ON p.user_id=c.user_id
          WHERE c.token_digest=$1 AND c.purpose=$2 AND c.consumed_at IS NULL AND c.expires_at>now()
            AND c.login_email=p.login_email AND c.credential_revision=p.credential_revision
          FOR UPDATE OF p,c`, [digestToken(token),purpose])).rows[0];
        if (!credential || !await profile(client, credential.user_id)) return false;
        if (purpose === "verify_email" && !await checkPassword(credential.password_hash, password)) return false;
        if (purpose === "reset_password" && !credential.email_verified_at) return false;
        await client.query("UPDATE learning_space_auth.email_challenges SET consumed_at=now() WHERE id=$1", [credential.challenge_id]);
        if (purpose === "verify_email") {
          await client.query("UPDATE learning_space_auth.password_credentials SET email_verified_at=now(),credential_revision=credential_revision+1 WHERE user_id=$1", [credential.user_id]);
          await client.query("UPDATE learning_space.users SET email_verified_at=now() WHERE id=$1", [credential.user_id]);
        } else {
          await client.query("UPDATE learning_space_auth.password_credentials SET password_hash=$2,credential_revision=credential_revision+1 WHERE user_id=$1", [credential.user_id,replacementHash]);
          await client.query("UPDATE learning_space.users SET session_version=session_version+1 WHERE id=$1", [credential.user_id]);
        }
        return true;
      });
    },
    async session(id: string, version: number) {
      return transaction(async client => {
        const user = await profile(client, id);
        return user?.sessionVersion === version ? user : null;
      });
    },
  };
}
