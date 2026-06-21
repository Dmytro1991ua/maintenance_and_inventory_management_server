import {
  REDIS_INITIAL_RETRY_DELAY_MS,
  REDIS_MAX_RECONNECT_ATTEMPTS,
  REDIS_MAX_RETRY_DELAY_MS,
} from "../../../src/config/constants";
import { getRedisRetryStrategy } from "../../../src/config/utils";

describe("getRedisRetryStrategy", () => {
  it("should return the initial delay on the first attempt", () => {
    expect(getRedisRetryStrategy(1)).toBe(REDIS_INITIAL_RETRY_DELAY_MS * 1);
  });

  it("should increase the delay linearly with each attempt", () => {
    expect(getRedisRetryStrategy(3)).toBe(REDIS_INITIAL_RETRY_DELAY_MS * 3);
  });

  it("should return null when attempts exceed REDIS_MAX_RECONNECT_ATTEMPTS", () => {
    expect(getRedisRetryStrategy(REDIS_MAX_RECONNECT_ATTEMPTS + 1)).toBeNull();
  });

  it("should return the exact computed delay at the max attempt boundary", () => {
    expect(getRedisRetryStrategy(REDIS_MAX_RECONNECT_ATTEMPTS)).toBe(
      REDIS_MAX_RECONNECT_ATTEMPTS * REDIS_INITIAL_RETRY_DELAY_MS,
    );
  });

  // REDIS_MAX_RECONNECT_ATTEMPTS × REDIS_INITIAL_RETRY_DELAY_MS (currently
  // 10 × 100ms = 1000ms) never reaches REDIS_MAX_RETRY_DELAY_MS (3000ms), so
  // the Math.min cap inside getRedisRetryStrategy can't actually be triggered
  // by any valid attempt number today — attempts beyond the max return null
  // before the cap is even evaluated. This test locks in that invariant; if
  // it ever fails, the cap has become reachable and needs a real test for it.
  it("should keep the max possible delay under the configured cap", () => {
    const maxPossibleDelay = REDIS_MAX_RECONNECT_ATTEMPTS * REDIS_INITIAL_RETRY_DELAY_MS;

    expect(maxPossibleDelay).toBeLessThan(REDIS_MAX_RETRY_DELAY_MS);
  });
});
