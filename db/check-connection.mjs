import assert from 'node:assert/strict';
import pg from 'pg';
import { connectionConfig } from './supabase-config.mjs';

process.loadEnvFile('.env.local');
let completed=0;
try {
  for(const [name,role] of [['DATABASE_URL','learning_space_app'],['DATABASE_AUTH_URL','learning_space_authenticator']]) {
    const client=new pg.Client(connectionConfig(process.env[name],role));
    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      const flags=(await client.query(`SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`)).rows[0];
      assert.equal(flags.rolname,role);
      for(const flag of ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole']) assert.equal(flags[flag],false);
      const policies=await client.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='learning_space' AND c.relkind='r'`);
      assert.equal(policies.rows.length,6);
      for(const table of policies.rows) {assert.equal(table.relrowsecurity,true);assert.equal(table.relforcerowsecurity,true);}
      assert.equal((await client.query('SELECT id FROM learning_space.users LIMIT 1')).rows.length,0);
      if(role==='learning_space_app') {
        const access=(await client.query("SELECT has_schema_privilege(current_user,'learning_space_auth','USAGE') AS auth_access,has_schema_privilege(current_user,'public','CREATE') AS public_ddl")).rows[0];
        assert.equal(access.auth_access,false); assert.equal(access.public_ddl,false);
      } else {
        // LIMIT 0 checks permission without retrieving any credentials or identity data.
        for(const table of ['identities','password_credentials','email_challenges']) {
          await client.query(`SELECT * FROM learning_space_auth.${table} LIMIT 0`);
        }
        assert.equal((await client.query("SELECT has_table_privilege(current_user,'learning_space.books','SELECT') AS book_access")).rows[0].book_access,false);
      }
      await client.query('ROLLBACK');
      completed++;
      console.log(`PASS ${role}: TLS connection, restricted privileges, ownership RLS and missing-context denial`);
    } finally { await client.end().catch(()=>{}); }
  }
  console.log(`${completed} hosted role connections verified. Profile/book APIs are not connected yet.`);
} catch(error) {
  console.error(`Hosted connection check failed; inspect credentials, TLS, schema or grants privately.${error.code?' Code: '+String(error.code).replace(/[^A-Z0-9_]/gi,''):''}`);
  process.exitCode=1;
}
