import "dotenv/config";

import { prisma } from "../../src/config";

process.env.NODE_ENV = "test";

// Integration tests hit a real Postgres instance — allow more time per test
jest.setTimeout(15000);

// Clean tables before every test — order matters (children before parents, FK constraints)
beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
