import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { connectionConfig, supabaseUrl } from './supabase-config.mjs';

// Run manually after schemas are installed. Does not migrate, deploy or rotate roles.
process.loadEnvFile('.env.local');
if (!process.env.SUPABASE_DB_PASSWORD) {
  console.error('Save SUPABASE_DB_PASSWORD privately in .env.local first. Never paste it in chat.');
  process.exit(1);
}
const client = new pg.Client(connectionConfig(supabaseUrl('postgres',process.env.SUPABASE_DB_PASSWORD),'postgres'));
let connected = false;
let transaction = false;
try {
  await client.connect(); connected = true;
  const schema = await client.query(`SELECT data_type FROM information_schema.columns
    WHERE table_schema='learning_space' AND table_name='users' AND column_name='id'`);
  if (schema.rows[0]?.data_type !== 'uuid') throw new Error('Install migrations 001 and 002 before provisioning roles');
  const existing = await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('learning_space_app','learning_space_authenticator')");
  if (existing.rows.length) throw new Error('Application roles already exist; credentials will not be rotated automatically');
  const appPassword=randomBytes(32).toString('hex');
  const authPassword=randomBytes(32).toString('hex');
  const values={DATABASE_URL:supabaseUrl('learning_space_app',appPassword),DATABASE_AUTH_URL:supabaseUrl('learning_space_authenticator',authPassword)};
  // Private recovery copy before changing remote roles; never contains the owner password.
  const pendingFile=new URL('../.env.database.pending.local',import.meta.url);
  await writeFile(pendingFile,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{flag:'wx'});
  await client.query('BEGIN'); transaction = true;
  await client.query("SELECT pg_advisory_xact_lock(hashtext('learning_space:role-provisioning'))");
  // Only generated hex strings are inserted in DDL; no user-provided SQL fragments.
  for (const [role, secret] of [['learning_space_app',appPassword],['learning_space_authenticator',authPassword]]) {
    if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid generated credential');
    await client.query(`CREATE ROLE ${role} LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await client.query(`GRANT CONNECT ON DATABASE postgres TO ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA learning_space TO ${role}`);
  }
  await client.query(`GRANT SELECT ON learning_space.users TO learning_space_app;
    GRANT SELECT,INSERT,UPDATE,DELETE ON learning_space.books,learning_space.chapters,learning_space.folders,
      learning_space.generation_attempts,learning_space.exports TO learning_space_app;
    GRANT SELECT,INSERT,UPDATE ON learning_space.users TO learning_space_authenticator;
    GRANT USAGE ON SCHEMA learning_space_auth TO learning_space_authenticator;
    GRANT SELECT,INSERT,UPDATE,DELETE ON learning_space_auth.identities,learning_space_auth.password_credentials,
      learning_space_auth.email_challenges TO learning_space_authenticator;`);
  await client.query('COMMIT'); transaction = false;
  const envFile=new URL('../.env.local',import.meta.url);
  let env=await readFile(envFile,'utf8');
  for(const [key,value] of Object.entries(values)) {
    const pattern=new RegExp('^'+key+'=.*$','m');
    env=pattern.test(env)?env.replace(pattern,key+'='+value):env+'\n'+key+'='+value+'\n';
  }
  await writeFile(envFile,env);
  console.log('Restricted application/authentication roles created; connection URLs saved privately in .env.local.');
  console.log('Run npm run db:check next. No application routes or Vercel environment values were changed.');
} catch (error) {
  if (transaction) await client.query('ROLLBACK').catch(()=>{});
  const safeReasons=['Install migrations','Application roles already','Invalid generated'];
  const detail=safeReasons.some(prefix=>error.message?.startsWith(prefix))?error.message:'Connection/provisioning failed. Check credentials, TLS and permissions privately.';
  console.error(`${detail}${error.code?' Code: '+String(error.code).replace(/[^A-Z0-9_]/gi,''):''}`);
  console.error('If the pending credential file exists, retain it privately for recovery; do not blindly rerun or rotate existing roles.');
  process.exitCode=1;
} finally {
  if (connected) await client.end();
}
