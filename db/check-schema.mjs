import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated in-memory PostgreSQL only; never reads DATABASE_URL or real account data.
const db = new PGlite();
let checks = 0;
async function check(name, task) {
  await task();
  checks++;
  console.log(`PASS ${name}`);
}
async function asUser(id, task) {
  return db.transaction(async tx => {
    await tx.query("SELECT set_config('app.user_id', $1, true)", [id]);
    return task(tx);
  });
}
async function rejectsCode(task, code) {
  await assert.rejects(task, error => error.code === code);
}
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
// Encoded-looking fixture only; this script does not implement password hashing.
const fixtureHash = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC1maXh0dXJl$Zml4dHVyZS1oYXNoLW9ubHktbm90LWEtcGFzc3dvcmQ';
let book, folder, chapter;
try {
  await check('initial migration applies to fresh PostgreSQL', async () => {
    await db.exec(await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8'));
  });
  await check('forward account migration preserves existing Google accounts and every owned table', async () => {
    await db.exec(`INSERT INTO learning_space.users(id,email,name) VALUES ('google:legacy','legacy@example.com','Legacy');
      INSERT INTO learning_space.folders(id,owner_id,name) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','google:legacy','Legacy folder');
      INSERT INTO learning_space.books(id,owner_id,folder_id,topic,title,estimated_total_pages)
        VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','google:legacy','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MCP','Legacy book',10);
      INSERT INTO learning_space.chapters(id,owner_id,book_id,chapter_number,title,estimated_pages,core_goal,sections,markdown)
        VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','google:legacy','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'Intro',10,'Learn','["Intro"]','မြန်မာ legacy content');
      INSERT INTO learning_space.generation_attempts(owner_id,book_id,chapter_id,request_key,expected_content_revision,model,prompt_version)
        VALUES ('google:legacy','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',gen_random_uuid(),0,'test','v1');
      INSERT INTO learning_space.exports(owner_id,book_id,format,book_revision)
        VALUES ('google:legacy','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','markdown',1);`);
    await db.exec(await readFile(new URL('./migrations/002_account_identities.sql', import.meta.url), 'utf8'));
    const legacy = (await db.query("SELECT user_id FROM learning_space_auth.identities WHERE provider='google' AND provider_subject='legacy'")).rows[0].user_id;
    assert.match(legacy, /^[0-9a-f-]{36}$/);
    for (const table of ['folders','books','chapters','generation_attempts','exports']) {
      assert.equal((await db.query(`SELECT owner_id FROM learning_space.${table}`)).rows[0].owner_id, legacy);
    }
    assert.equal((await db.query('SELECT markdown FROM learning_space.chapters')).rows[0].markdown, 'မြန်မာ legacy content');
    assert.equal((await db.query('SELECT email_verified_at FROM learning_space.users')).rows[0].email_verified_at, null);
    await db.query('DELETE FROM learning_space.users WHERE id=$1', [legacy]);
  });
  await check('migrations apply in order to an empty database too', async () => {
    const fresh = new PGlite();
    try {
      for (const migration of ['001_initial.sql','002_account_identities.sql']) {
        await fresh.exec(await readFile(new URL('./migrations/'+migration, import.meta.url), 'utf8'));
      }
      const generated = (await fresh.query("INSERT INTO learning_space.users(email) VALUES ('new@example.com') RETURNING id")).rows[0].id;
      assert.match(generated, /^[0-9a-f-]{36}$/);
    } finally { await fresh.close(); }
  });
  await check('book runtime role has explicit content privileges only', async () => {
    await db.exec(`CREATE ROLE learning_space_app NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA learning_space TO learning_space_app;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA learning_space TO learning_space_app;
      SET ROLE learning_space_app;`);
  });
  await check('permanent account IDs create only their own profiles, including Burmese', async () => {
    for (const id of [alice, bob]) {
      await asUser(id, tx => tx.query('INSERT INTO learning_space.users(id,email,name) VALUES ($1,$2,$3)', [id, `${id.slice(0,8)}@example.com`, 'မြန်မာစာ']));
    }
    await rejectsCode(() => asUser(alice, tx => tx.query("INSERT INTO learning_space.users(id,email) VALUES ('33333333-3333-4333-8333-333333333333','other@example.com')")), '42501');
  });
  await check('credential, provider identity and challenge records are inaccessible to book runtime', async () => {
    for (const table of ['identities','password_credentials','email_challenges']) {
      await rejectsCode(() => asUser(alice, tx => tx.query(`SELECT * FROM learning_space_auth.${table}`)), '42501');
      await rejectsCode(() => asUser(alice, tx => tx.query(`DELETE FROM learning_space_auth.${table}`)), '42501');
      await rejectsCode(() => asUser(alice, tx => tx.query(`INSERT INTO learning_space_auth.${table} DEFAULT VALUES`)), '42501');
    }
  });
  await check('legacy Google session context cannot access new UUID accounts', async () => {
    assert.equal((await asUser('google:alice', tx=>tx.query('SELECT * FROM learning_space.users'))).rows.length, 0);
  });
  await db.exec('RESET ROLE');
  await check('Google provider subject maps uniquely and can coexist with a password identity', async () => {
    await db.query("INSERT INTO learning_space_auth.identities(user_id,provider,provider_subject) VALUES ($1,'google','alice-subject')", [alice]);
    await db.query('INSERT INTO learning_space_auth.password_credentials(user_id,login_email,password_hash) VALUES ($1,$2,$3)', [alice,'alice@example.com',fixtureHash]);
    await rejectsCode(() => db.query("INSERT INTO learning_space_auth.identities(user_id,provider,provider_subject) VALUES ($1,'google','alice-subject')", [bob]), '23505');
    // Same display email does not create a provider link or merge accounts.
    await db.query("UPDATE learning_space.users SET email='alice@example.com' WHERE id IN ($1,$2)", [alice,bob]);
    assert.equal((await db.query('SELECT * FROM learning_space_auth.identities WHERE user_id=$1', [bob])).rows.length, 0);
  });
  await check('password identity rejects plaintext and unnormalized or duplicate login emails', async () => {
    await rejectsCode(() => db.query('INSERT INTO learning_space_auth.password_credentials(user_id,login_email,password_hash) VALUES ($1,$2,$3)', [bob,'bob@example.com','plain-password']), '23514');
    await rejectsCode(() => db.query('INSERT INTO learning_space_auth.password_credentials(user_id,login_email,password_hash) VALUES ($1,$2,$3)', [bob,'Alice@Example.com',fixtureHash]), '23514');
    await rejectsCode(() => db.query('INSERT INTO learning_space_auth.password_credentials(user_id,login_email,password_hash) VALUES ($1,$2,$3)', [bob,'alice@example.com',fixtureHash]), '23505');
  });
  const challengeSql = `INSERT INTO learning_space_auth.email_challenges(user_id,purpose,token_digest,login_email,credential_revision,expires_at)
    VALUES ($1,$2,$3,'alice@example.com',1,now()+interval '30 minutes') RETURNING id`;
  await check('email challenges require digests and valid purpose and expiration', async () => {
    await rejectsCode(() => db.query(challengeSql, [alice,'reset_password','raw-reset-token']), '23514');
    await rejectsCode(() => db.query(challengeSql, [alice,'unknown','b'.repeat(64)]), '23514');
    await rejectsCode(() => db.query("INSERT INTO learning_space_auth.email_challenges(user_id,purpose,token_digest,login_email,credential_revision,expires_at) VALUES ($1,'verify_email',$2,'alice@example.com',1,now()-interval '1 minute')", [alice,'c'.repeat(64)]), '23514');
    await rejectsCode(() => db.query("INSERT INTO learning_space_auth.email_challenges(user_id,purpose,token_digest,login_email,credential_revision,expires_at) VALUES ($1,'verify_email',$2,'alice@example.com',1,now()+interval '25 hours')", [alice,'d'.repeat(64)]), '23514');
  });
  await check('challenge consumption predicate rejects reused, expired and stale revisions', async () => {
    const challenge = (await db.query(challengeSql,[alice,'reset_password','a'.repeat(64)])).rows[0].id;
    const consume = `UPDATE learning_space_auth.email_challenges c SET consumed_at=now()
      FROM learning_space_auth.password_credentials p WHERE c.id=$1 AND c.user_id=p.user_id
      AND c.purpose=$2
      AND c.login_email=p.login_email AND c.credential_revision=p.credential_revision
      AND c.consumed_at IS NULL AND c.expires_at>now() RETURNING c.id`;
    assert.equal((await db.query(consume,[challenge,'verify_email'])).rows.length,0);
    assert.equal((await db.query(consume,[challenge,'reset_password'])).rows.length,1);
    assert.equal((await db.query(consume,[challenge,'reset_password'])).rows.length,0);
    const stale = (await db.query(challengeSql,[alice,'verify_email','e'.repeat(64)])).rows[0].id;
    await db.query('UPDATE learning_space_auth.password_credentials SET credential_revision=2 WHERE user_id=$1', [alice]);
    assert.equal((await db.query(consume,[stale,'verify_email'])).rows.length,0);
    await db.exec("INSERT INTO learning_space_auth.email_challenges(user_id,purpose,token_digest,login_email,credential_revision,created_at,expires_at) VALUES ('11111111-1111-4111-8111-111111111111','reset_password',repeat('f',64),'alice@example.com',2,now()-interval '2 hours',now()-interval '1 hour')");
    const expired=(await db.query("SELECT id FROM learning_space_auth.email_challenges WHERE token_digest=repeat('f',64)")).rows[0].id;
    assert.equal((await db.query(consume,[expired,'reset_password'])).rows.length,0);
  });
  await db.exec('SET ROLE learning_space_app');
  await check('book, folder and ordered chapter metadata map to the current app', async () => {
    await asUser(alice, async tx => {
      folder = (await tx.query("INSERT INTO learning_space.folders(owner_id,name) VALUES ($1,'MCP') RETURNING id", [alice])).rows[0].id;
      book = (await tx.query("INSERT INTO learning_space.books(owner_id,folder_id,topic,title,estimated_total_pages) VALUES ($1,$2,'MCP in Burmese','MCP',30) RETURNING id", [alice, folder])).rows[0].id;
      chapter = (await tx.query(`INSERT INTO learning_space.chapters(owner_id,book_id,chapter_number,title,estimated_pages,core_goal,sections)
        VALUES ($1,$2,1,'Introduction',10,'Understand MCP','["Concepts","Example"]') RETURNING id`, [alice, book])).rows[0].id;
    });
  });
  await check('missing transaction context denies reads and writes', async () => {
    assert.equal((await db.query('SELECT * FROM learning_space.books')).rows.length, 0);
    await rejectsCode(() => db.query("INSERT INTO learning_space.folders(owner_id,name) VALUES ($1,'forbidden')", [alice]), '42501');
  });
  await check('other account cannot read, update or delete private data', async () => {
    await asUser(bob, async tx => {
      for (const table of ['users','folders','books','chapters']) {
        const result = await tx.query(`SELECT * FROM learning_space.${table}`);
        assert.equal(result.rows.length, table === 'users' ? 1 : 0);
      }
      assert.equal((await tx.query('UPDATE learning_space.books SET title = $1 WHERE id = $2 RETURNING id', ['stolen',book])).rows.length, 0);
      assert.equal((await tx.query('DELETE FROM learning_space.books WHERE id = $1 RETURNING id', [book])).rows.length, 0);
    });
  });
  await check('composite foreign keys reject cross-owner folders and chapters', async () => {
    await rejectsCode(() => asUser(bob, tx => tx.query("INSERT INTO learning_space.books(owner_id,folder_id,topic,title,estimated_total_pages) VALUES ($1,$2,'test','test',1)", [bob,folder])), '23503');
    await rejectsCode(() => asUser(bob, tx => tx.query("INSERT INTO learning_space.chapters(owner_id,book_id,chapter_number,title,estimated_pages,core_goal,sections) VALUES ($1,$2,2,'bad',1,'bad','[\"test\"]')", [bob,book])), '23503');
  });
  await check('duplicate chapter order is rejected', async () => {
    await rejectsCode(() => asUser(alice, tx => tx.query("INSERT INTO learning_space.chapters(owner_id,book_id,chapter_number,title,estimated_pages,core_goal,sections) VALUES ($1,$2,1,'duplicate',1,'test','[\"test\"]')", [alice,book])), '23505');
  });
  const attemptSql = `INSERT INTO learning_space.generation_attempts(owner_id,book_id,chapter_id,request_key,expected_content_revision,model,prompt_version)
    VALUES ($1,$2,$3,gen_random_uuid(),0,'test-model','v1')`;
  await check('active generation is exclusive per chapter and retryable after failure', async () => {
    await asUser(alice, tx => tx.query(attemptSql, [alice,book,chapter]));
    await rejectsCode(() => asUser(alice, tx => tx.query(attemptSql, [alice,book,chapter])), '23505');
    await asUser(alice, async tx => {
      await tx.query("UPDATE learning_space.generation_attempts SET status='failed',finished_at=now(),error_code='PROVIDER_TIMEOUT' WHERE chapter_id=$1", [chapter]);
      await tx.query(attemptSql, [alice,book,chapter]);
    });
  });
  await check('stale content revision cannot overwrite accepted Markdown', async () => {
    await asUser(alice, async tx => {
      assert.equal((await tx.query("UPDATE learning_space.chapters SET markdown='မြန်မာ MCP',content_revision=content_revision+1 WHERE id=$1 AND content_revision=0 RETURNING id", [chapter])).rows.length, 1);
      assert.equal((await tx.query("UPDATE learning_space.chapters SET markdown='stale' WHERE id=$1 AND content_revision=0 RETURNING id", [chapter])).rows.length, 0);
    });
  });
  await check('ready export requires private object metadata', async () => {
    await rejectsCode(() => asUser(alice, tx => tx.query("INSERT INTO learning_space.exports(owner_id,book_id,format,book_revision,status) VALUES ($1,$2,'pdf',1,'ready')", [alice,book])), '23514');
  });
  await check('folder deletion preserves books and requires explicit unlink', async () => {
    await rejectsCode(() => asUser(alice, tx => tx.query('DELETE FROM learning_space.folders WHERE id=$1', [folder])), '23503');
    await asUser(alice, async tx => {
      await tx.query('UPDATE learning_space.books SET folder_id=NULL WHERE id=$1', [book]);
      await tx.query('DELETE FROM learning_space.folders WHERE id=$1', [folder]);
      assert.equal((await tx.query('SELECT id FROM learning_space.books WHERE id=$1', [book])).rows.length, 1);
    });
  });
  await check('profile deletion cascades only its owned records', async () => {
    await asUser(alice, tx => tx.query('DELETE FROM learning_space.users WHERE id=$1', [alice]));
    await asUser(alice, async tx => {
      for (const table of ['books','chapters','generation_attempts','exports']) {
        assert.equal((await tx.query(`SELECT * FROM learning_space.${table}`)).rows.length, 0);
      }
    });
    assert.equal((await asUser(bob, tx => tx.query('SELECT * FROM learning_space.users'))).rows.length, 1);
  });
  await check('account deletion also removes provider, credential and challenge rows', async () => {
    await db.exec('RESET ROLE');
    for (const table of ['identities','password_credentials','email_challenges']) {
      assert.equal((await db.query(`SELECT * FROM learning_space_auth.${table} WHERE user_id=$1`,[alice])).rows.length,0);
    }
  });
  console.log(`${checks} database checks passed. Hosted connection and app integration remain pending.`);
} finally {
  await db.close();
}
