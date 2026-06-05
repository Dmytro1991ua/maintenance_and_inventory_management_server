import app from "./app";
import { env, logger, prisma, redis } from "./config";
import { SERVER_SHUTDOWN_TIMEOUT_MS } from "./constants";

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");

  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection — shutting down");

  process.exit(1);
});

// Fail fast — verify connections at startup rather than surface errors on the first request.
prisma
  .$connect()
  .then(() => logger.info("Postgres connected"))
  .catch((err) => {
    logger.fatal({ err }, "Postgres failed");

    process.exit(1);
  });

// ping() triggers the first connection (lazyConnect: true); redis.ts event handlers log the result.
redis.ping().catch((err) => {
  logger.fatal({ err }, "Redis failed");

  process.exit(1);
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeVersion: process.version, pid: process.pid }, "Server started");
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Shutting down");

  const forceExit = setTimeout(() => {
    logger.error("Shutdown timed out — forcing exit");

    process.exit(1);
  }, SERVER_SHUTDOWN_TIMEOUT_MS);

  forceExit.unref(); // don't keep the process alive if everything else closes first

  // Close the server first to stop accepting new requests, then disconnect dependencies.
  server.close(async () => {
    try {
      await prisma.$disconnect();
      redis.disconnect();
      clearTimeout(forceExit);
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Shutdown error");
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
