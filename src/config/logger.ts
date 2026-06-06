import pino from "pino";

import { env } from "./env";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",

  base: {
    service: "maintenance-and-inventory-management",
    env: env.NODE_ENV,
  },

  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});
