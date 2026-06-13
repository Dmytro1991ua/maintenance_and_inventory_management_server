import "dotenv/config";

import bcrypt from "bcrypt";

import { prisma } from "../src/config/prisma";
import { Role } from "../src/generated/prisma/client";

const seed = async (): Promise<void> => {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("❌ SEED_ADMIN_PASSWORD env var is required");

    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      userName: "admin",
      email: "admin@example.com",
      password: hashedPassword,
      roles: [Role.ADMIN],
    },
  });

  console.log("✅ Seeded admin user:", admin.email);
};

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
