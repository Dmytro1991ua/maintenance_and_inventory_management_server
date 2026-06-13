import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    // process.env instead of Prisma's env() helper — env() throws at load time
    // when the variable is missing, which breaks `prisma generate` inside Docker
    // builds where DATABASE_URL is not available. process.env returns undefined
    // silently; generate never connects to the DB so the value isn't needed there.
    url: process.env.DATABASE_URL,
  },
});
