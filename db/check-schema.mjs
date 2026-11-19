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
const alice = 'google:alice';
const bob = 'google:bob';
let book, folder, chapter;
try {
  await check('migration applies to fresh PostgreSQL', async () => {
    await db.exec(await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8'));
    await db.exec(`CREATE ROLE learning_space_app NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA learning_space TO learning_space_app;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA learning_space TO learning_space_app;
      SET ROLE learning_space_app;`);
  });
  await check('verified subjects can create only their own profiles, including Burmese', async () => {
    for (const id of [alice, bob]) {
      await asUser(id, tx => tx.query('INSERT INTO learning_space.users(id,email,name) VALUES ($1,$2,$3)', [id, `${id.slice(7)}@example.com`, 'မြန်မာစာ']));
    }
    await rejectsCode(() => asUser(alice, tx => tx.query("INSERT INTO learning_space.users(id,email) VALUES ('google:other','other@example.com')")), '42501');
  });
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
  console.log(`${checks} database checks passed. Hosted connection and app integration remain pending.`);
} finally {
  await db.close();
}
