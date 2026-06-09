import { randomUUID } from "node:crypto";

import { redis } from "../../config";

// Only deletes the key if it still holds the token this run set — prevents an
// instance from releasing a lock it no longer holds (e.g. one that already
// expired and was re-acquired by another instance).
const RELEASE_LOCK_IF_TOKEN_MATCHES_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

/**
 * Runs `task` only if this instance acquires the named Redis lock first.
 *
 * Guards cron jobs that must execute exactly once even when multiple server
 * instances register the same schedule: every instance's scheduler still
 * fires, but `SET ... NX` only succeeds for the first one to reach Redis —
 * the rest find the key already held and skip the run entirely.
 *
 * `ttlMs` bounds how long the lock survives if the holder crashes mid-run;
 * pick a value comfortably larger than the job's expected duration but well
 * under the gap between scheduled runs.
 */
export const withLock = async (
  key: string,
  ttlMs: number,
  task: () => Promise<void>,
): Promise<void> => {
  // Unique per call so the release script can tell "my lock" from "someone
  // else's lock that happens to occupy the same key right now".
  const lockToken = randomUUID();

  // only the first instance to reach Redis wins;
  // everyone else gets null back and skips the run entirely (no job logic, no DB queries — true single-execution, not just dedup-after-the-fact).
  const lockAcquired = (await redis.set(key, lockToken, "PX", ttlMs, "NX")) === "OK";

  if (!lockAcquired) return;

  try {
    await task();
  } finally {
    await redis.eval(RELEASE_LOCK_IF_TOKEN_MATCHES_SCRIPT, 1, key, lockToken);
  }
};
