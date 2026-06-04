import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema", // ← points to folder
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts", // ← we'll add seed later
  },
  datasource: {
    url: env("DATABASE_URL"), // ← url lives here now in Prisma 7
  },
});
