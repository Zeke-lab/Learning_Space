import assert from "node:assert/strict";
import test from "node:test";
import { runChapterQueue } from "../lib/chapter-queue.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("starts two requests and fills an available slot without waiting for the other request", async () => {
  const gates = Array.from({ length: 4 }, deferred);
  const started = [];
  const finished = [];
  let active = 0;
  let peak = 0;
  const queue = runChapterQueue([0, 1, 2, 3], async (id) => {
    started.push(id);
    peak = Math.max(peak, ++active);
    const result = await gates[id].promise;
    active -= 1;
    return result;
  }, (count) => finished.push(count));

  assert.deepEqual(started, [0, 1]);
  gates[1].resolve(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2]);
  assert.equal(active, 2);
  gates[2].resolve(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2, 3]);
  gates[3].resolve(true);
  gates[0].resolve(true);
  assert.equal(await queue, true);
  assert.equal(peak, 2);
  assert.deepEqual(finished, [1, 2, 3, 4]);
});

test("failure stops queued chapters but waits for the other request to finish", async () => {
  const gates = [deferred(), deferred()];
  const started = [];
  let queueFinished = false;
  const queue = runChapterQueue([0, 1, 2, 3], (id) => {
    started.push(id);
    return gates[id].promise;
  }, () => {}).then((result) => { queueFinished = true; return result; });
  gates[0].resolve(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [0, 1]);
  assert.equal(queueFinished, false);
  gates[1].resolve(true);
  assert.equal(await queue, false);
  assert.deepEqual(started, [0, 1]);
});

test("unexpected rejection also drains in-flight work without starting new requests", async () => {
  const first = deferred();
  const second = deferred();
  const started = [];
  const settled = [];
  const queue = runChapterQueue([0, 1, 2], (id) => {
    started.push(id);
    return id === 0 ? first.promise : second.promise;
  }, (count) => settled.push(count));
  first.reject(new Error("Request failed"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(settled, [1]);
  second.resolve(true);
  assert.equal(await queue, false);
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(settled, [1, 2]);
});

test("empty and single-chapter queues do not start extra work", async () => {
  let calls = 0;
  const write = async () => { calls += 1; return true; };
  assert.equal(await runChapterQueue([], write, () => {}), true);
  assert.equal(calls, 0);
  assert.equal(await runChapterQueue([1], write, () => {}), true);
  assert.equal(calls, 1);
});
