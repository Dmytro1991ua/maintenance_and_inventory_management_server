import Redis, { type RedisOptions } from "ioredis";
import { getRedisRetryStrategy } from "../utils/redis.utils";
import { env } from "./env";
import { logger } from "./logger";

const createRedisClient = (): Redis => {
  const options: RedisOptions = {
    // Don't connect on import — only on first command.
    // Redis outage won't crash startup, only features that need Redis.
    lazyConnect: true,
    retryStrategy: (times: number) => {
      const delay = getRedisRetryStrategy(times);

      if (delay === null) {
        logger.error("Redis: max reconnection attempts reached — giving up");

        return null;
      }

      logger.warn(`Redis: reconnecting in ${delay}ms (attempt ${times})`);

      return delay;
    },
    // Auto-enable TLS for cloud Redis (rediss://) — enforces cert validation.
    // Local dev uses redis:// so this block is skipped entirely.
    ...(env.REDIS_URL.startsWith("rediss://") ? { tls: { rejectUnauthorized: true } } : {}),
  };

  const client = new Redis(env.REDIS_URL, options);

  client.on("connect", () => logger.info("Redis: connected"));
  client.on("ready", () => logger.debug("Redis: ready"));
  client.on("error", (err) => logger.error({ err }, "Redis: error"));
  client.on("close", () => logger.warn("Redis: connection closed"));
  client.on("reconnecting", () => logger.warn("Redis: reconnecting"));
  client.on("end", () => logger.warn("Redis: connection ended — gave up"));

  return client;
};

export const redis = createRedisClient();
