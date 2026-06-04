import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";
import { logger } from "./logger";

const logOptions =
  env.NODE_ENV === "development"
    ? [
        { emit: "event" as const, level: "query" as const },
        { emit: "event" as const, level: "error" as const },
        { emit: "event" as const, level: "warn" as const },
      ]
    : [{ emit: "event" as const, level: "error" as const }];

// Prisma v7's new `prisma-client` generator requires a driver adapter;
// it no longer reads DATABASE_URL implicitly at runtime (only the CLI does).
const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const createPrismaClient = () => new PrismaClient({ adapter, log: logOptions });

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    logger.debug(
      {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      },
      "DB query",
    );
  });

  prisma.$on("warn", (e) => {
    logger.warn({ message: e.message }, "DB warning");
  });
}

prisma.$on("error", (e) => {
  logger.error({ message: e.message, target: e.target }, "DB error");
});

// Reuse instance across hot reloads in development.
// Without this, ts-node-dev creates a new PrismaClient on every
// file save and exhausts the connection pool within minutes.
if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
