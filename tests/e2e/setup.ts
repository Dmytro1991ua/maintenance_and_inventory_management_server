import "dotenv/config";

import { prisma, redis } from "../../src/config";

process.env.NODE_ENV = "test";

// E2E tests run full HTTP requests against real Postgres + Redis — allow more time
jest.setTimeout(15000);

// Same order as the integration setup (children before parents), since integration files leave rows behind
beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.workOrderRequest.deleteMany();
  await prisma.task.deleteMany();
  await prisma.recurringTask.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.reorder.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.userInvite.deleteMany();
  await prisma.user.deleteMany();
  await prisma.checklistTemplate.deleteMany();

  // Clear all auth-related Redis keys (refresh tokens, session sets) between tests
  const keys = await redis.keys("auth:*");

  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  await prisma.$disconnect();

  redis.disconnect();
});
