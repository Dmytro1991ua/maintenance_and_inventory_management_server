import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

app.listen(env.PORT, () => {
  logger.info({
    message: "Server started",
    port: env.PORT,
    env: env.NODE_ENV,
    nodeVersion: process.version,
    pid: process.pid,
  });
});
