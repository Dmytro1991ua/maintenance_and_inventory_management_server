import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { checkDueSoonTasks } from "../../../src/jobs/cron/tasks/checkDueSoonTasks";
import {
  authHeader,
  createAdminUser,
  createTechnicianUser,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

// A new due date or assignee re-arms the due-soon reminder (clears reminderSentAt).
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

  it("should clear reminderSentAt when the task is reassigned", async () => {
    const admin = await createAdminUser();
    const [first, second] = [await createTechnicianUser(), await createTechnicianUser()];
    const task = await createTestTask({
      assignedTo: first.id,
      dueDate: new Date("2026-09-20T00:00:00.000Z"),
      reminderSentAt: new Date("2026-09-17T00:00:00.000Z"),
    });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assignedTo: second.id });

    expect(response.status).toBe(200);
    const stored = await prisma.task.findUnique({ where: { id: task.id } });
    expect(stored?.reminderSentAt).toBeNull();
  });

  it("should leave reminderSentAt intact when the same assignee is resent", async () => {
    const admin = await createAdminUser();
    const assignee = await createTechnicianUser();
    const reminderSentAt = new Date("2026-09-17T00:00:00.000Z");
    const task = await createTestTask({ assignedTo: assignee.id, reminderSentAt });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assignedTo: assignee.id, priority: "HIGH" });

    expect(response.status).toBe(200);
    const stored = await prisma.task.findUnique({ where: { id: task.id } });
    expect(stored?.reminderSentAt?.toISOString()).toBe(reminderSentAt.toISOString());
  });

  it("should remind the new assignee of a released task after it is reassigned", async () => {
    const admin = await createAdminUser();
    const [first, second] = [await createTechnicianUser(), await createTechnicianUser()];
    const task = await createTestTask({
      assignedTo: first.id,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await checkDueSoonTasks();

    await request(app)
      .patch(`/api/v1/users/${first.id}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "INACTIVE" });
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assignedTo: second.id });
    await checkDueSoonTasks();

    const reminders = await prisma.notification.findMany({
      where: { type: "TASK_DUE_SOON", relatedEntityId: task.id },
    });
    expect(reminders.map((r) => r.userId).sort()).toEqual([first.id, second.id].sort());
  });
});
