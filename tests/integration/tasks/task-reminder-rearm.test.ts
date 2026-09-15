import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { authHeader, createAdminUser, createTestTask, signTestAccessToken } from "../helpers";

// Rescheduling a task re-arms its due-soon reminder by clearing reminderSentAt,
// so the daily job can send a fresh reminder for the new due date.
describe("PATCH /api/v1/tasks/:id — due-soon reminder re-arm", () => {
  it("should clear reminderSentAt when the due date changes", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask({
      dueDate: new Date("2026-09-20T00:00:00.000Z"),
      reminderSentAt: new Date("2026-09-17T00:00:00.000Z"),
    });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ dueDate: "2026-10-05T00:00:00.000Z" });

    expect(response.status).toBe(200);

    const stored = await prisma.task.findUnique({ where: { id: task.id } });
    expect(stored?.reminderSentAt).toBeNull();
  });

  it("should leave reminderSentAt intact when the due date is unchanged", async () => {
    const admin = await createAdminUser();
    const reminderSentAt = new Date("2026-09-17T00:00:00.000Z");
    const task = await createTestTask({
      dueDate: new Date("2026-09-20T00:00:00.000Z"),
      reminderSentAt,
    });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ priority: "HIGH" });

    expect(response.status).toBe(200);

    const stored = await prisma.task.findUnique({ where: { id: task.id } });
    expect(stored?.reminderSentAt?.toISOString()).toBe(reminderSentAt.toISOString());
  });
});
