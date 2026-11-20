import assert from 'node:assert/strict';
import test from 'node:test';
import {X509Certificate} from 'node:crypto';
import { connectionConfig, supabaseUrl, poolerHost, projectRef } from '../db/supabase-config.mjs';

test('Supabase setup encodes password symbols without changing destination',()=>{
  const password='test:@/#?%+-not-a-real-password';
  const config=connectionConfig(supabaseUrl('learning_space_app',password),'learning_space_app');
  assert.equal(config.password,password);
  assert.equal(config.host,poolerHost);
  assert.equal(config.user,`learning_space_app.${projectRef}`);
});
test('Supabase connections verify TLS certificates and set bounded timeouts',()=>{
  const config=connectionConfig(supabaseUrl('learning_space_app','fixture'),'learning_space_app');
  assert.equal(config.ssl.rejectUnauthorized,true);
  const certificate=new X509Certificate(config.ssl.ca);
  assert.equal(certificate.ca,true);
  assert.equal(certificate.fingerprint256,'80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
  assert.ok(Date.parse(certificate.validTo)>Date.now());
  assert.equal(config.connectionTimeoutMillis,15000);
  assert.equal(config.statement_timeout,15000);
});
test('Supabase connection rejects admin credentials for the content role',()=>{
  assert.throws(()=>connectionConfig(supabaseUrl('postgres','fixture'),'learning_space_app'));
});
test('Supabase connection rejects wrong projects, hosts and protocols',()=>{
  const original=supabaseUrl('learning_space_app','fixture');
  for(const changed of [original.replace(poolerHost,'example.com'),original.replace(projectRef,'wrong-project'),original.replace('postgresql:','https:')]) {
    assert.throws(()=>connectionConfig(changed,'learning_space_app'));
  }
});
test('Supabase URL options cannot disable or override TLS checks',()=>{
  const original=supabaseUrl('learning_space_app','fixture');
  for(const query of ['sslmode=disable','sslrootcert=unexpected','options=unsafe','sslmode=no-verify']) {
    assert.throws(()=>connectionConfig(original+'?'+query,'learning_space_app'));
  }
  assert.equal(connectionConfig(original+'?sslmode=require','learning_space_app').ssl.rejectUnauthorized,true);
});
test('invalid connection errors do not echo passwords or URLs',()=>{
  const secret='fixture-secret-do-not-log';
  try { connectionConfig(`postgresql://wrong:${secret}@example.com/postgres`,'learning_space_app'); assert.fail('must reject'); }
  catch(error) {assert.equal(error.message.includes(secret),false);assert.equal(error.message.includes('example.com'),false);}
});
