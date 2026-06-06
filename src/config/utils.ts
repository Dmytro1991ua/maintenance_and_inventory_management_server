import {
  REDIS_INITIAL_RETRY_DELAY_MS,
  REDIS_MAX_RECONNECT_ATTEMPTS,
  REDIS_MAX_RETRY_DELAY_MS,
} from "./constants";

// Calculates reconnection delay using exponential backoff.
// Returns delay in ms, or null when max attempts exceeded (signals ioredis to stop retrying).
export const getRedisRetryStrategy = (times: number): number | null => {
  if (times > REDIS_MAX_RECONNECT_ATTEMPTS) return null;

  return Math.min(times * REDIS_INITIAL_RETRY_DELAY_MS, REDIS_MAX_RETRY_DELAY_MS);
};
