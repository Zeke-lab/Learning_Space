export const CHAPTER_CONCURRENCY = 2;

// Stop admitting new work after a failure, but let requests already in flight
// finish so their chapters can still be saved before the batch becomes idle.
export async function runChapterQueue<T>(
  items: readonly T[],
  write: (item: T) => Promise<boolean>,
  onSettled: (count: number) => void,
): Promise<boolean> {
  let next = 0;
  let settled = 0;
  let failed = false;

  async function worker() {
    while (!failed && next < items.length) {
      const item = items[next++];
      let succeeded = false;
      try {
        succeeded = await write(item);
      } catch {
        // Drain the other worker even if a caller throws unexpectedly.
      }
      if (!succeeded) failed = true;
      onSettled(++settled);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CHAPTER_CONCURRENCY, items.length) }, worker));
  return !failed;
}
