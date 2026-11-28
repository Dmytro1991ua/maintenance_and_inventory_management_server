import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { generateRecurringTasks } from "../../../src/jobs/cron/tasks/generateRecurringTasks";
import { changeLogRepository } from "../../../src/modules/change-log/change-log.repository";
import {
  asUser,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestInventoryItem,
  createTestRecurringTask,
  createTestTask,
  onlyEntry,
  statusChange,
} from "../helpers";

jest.mock("../../../src/shared/email.service", () => ({
  emailService: { sendTaskAssignment: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../../src/shared/storage.service", () => ({
  storageService: {
    uploadTaskPhoto: jest.fn(),
    uploadAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
    deleteTaskPhoto: jest.fn().mockResolvedValue(undefined),
  },
}));

type TestUser = Awaited<ReturnType<typeof createAdminUser>>;

const patchTask = (user: TestUser, id: string, body: object) =>
  request(app).patch(`/api/v1/tasks/${id}`).set(asUser(user)).send(body);

afterEach(() => jest.restoreAllMocks());

describe("change log — tasks", () => {
  it("should record who created a task and its filled-in fields", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(asUser(manager))
      .send({ title: "Fix belt", priority: "HIGH" });

    expect(response.status).toBe(201);

    const entry = await onlyEntry("TASK");

    expect(entry).toMatchObject({
      action: "CREATE",
      entityId: response.body.data.id,
      entityLabel: "Fix belt",
      userId: manager.id,
      actorLabel: manager.userName,
    });
    expect(entry.changes).toEqual([
      { field: "title", oldValue: null, newValue: "Fix belt" },
      { field: "status", oldValue: null, newValue: "OPEN" },
      { field: "priority", oldValue: null, newValue: "HIGH" },
    ]);
  });

  it("should record only the fields an edit changed, under the new title", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask({ title: "Fix belt", priority: "LOW" });

    const response = await patchTask(manager, task.id, {
      title: "Fix drive belt",
      priority: "LOW",
    });

    expect(response.status).toBe(200);

    const entry = await onlyEntry("TASK");

    expect(entry).toMatchObject({
      action: "UPDATE",
      entityId: task.id,
      entityLabel: "Fix drive belt",
      userId: manager.id,
    });
    expect(entry.changes).toEqual([
      { field: "title", oldValue: "Fix belt", newValue: "Fix drive belt" },
    ]);
  });

  it("should record a reassignment with the old and new assignee", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    const task = await createTestTask();

    await patchTask(manager, task.id, { assignedTo: tech.id });

    expect((await onlyEntry("TASK")).changes).toEqual([
      { field: "assignedTo", oldValue: null, newValue: tech.id },
    ]);
  });

  it("should record a rescheduled task without the internal reminder flag", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask({
      dueDate: new Date("2027-03-01T00:00:00Z"),
      reminderSentAt: new Date(),
    });

    await patchTask(manager, task.id, { dueDate: "2027-03-05T00:00:00Z" });

    const entry = await onlyEntry("TASK");

    expect(entry.changes).toEqual([
      {
        field: "dueDate",
        oldValue: "2027-03-01T00:00:00.000Z",
        newValue: "2027-03-05T00:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(entry.changes)).not.toContain("reminderSentAt");
  });

  it("should record nothing when an edit changes nothing", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask({ title: "Fix belt" });

    const response = await patchTask(manager, task.id, { title: "Fix belt" });

    expect(response.status).toBe(200);
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record a technician's status change under the technician", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await patchTask(tech, task.id, { status: "IN_PROGRESS" });

    expect(response.status).toBe(200);

    const entry = await onlyEntry("TASK");

    expect(entry).toMatchObject({ userId: tech.id, actorLabel: tech.userName });
    expect(entry.changes).toEqual(statusChange("OPEN", "IN_PROGRESS"));
  });

  it("should record nothing when a technician is refused", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await patchTask(tech, task.id, { title: "Renamed by technician" });

    expect(response.status).toBe(403);
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record a completed task, but not the stock its parts used", async () => {
    const tech = await createTechnicianUser();
    const part = await createTestInventoryItem({ quantity: 5 });
    const task = await createTestTask({
      assignedTo: tech.id,
      afterPhotoUrl: "https://storage.example.com/tasks/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(asUser(tech))
      .send({ checklist: [], partsUsed: [{ inventoryItemId: part.id, quantity: 2 }] });

    expect(response.status).toBe(200);

    const entry = await onlyEntry("TASK");

    expect(entry).toMatchObject({ action: "UPDATE", entityId: task.id, userId: tech.id });
    expect(entry.changes).toEqual(statusChange("OPEN", "DONE"));
    expect(await prisma.changeLog.count({ where: { entityType: "INVENTORY_ITEM" } })).toBe(0);
  });

  it("should record a cancelled task with its reason", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/cancel`)
      .set(asUser(admin))
      .send({ reason: "Equipment was replaced" });

    expect(response.status).toBe(200);

    const entry = await onlyEntry("TASK");

    expect(entry).toMatchObject({ action: "UPDATE", userId: admin.id });
    expect(entry.changes).toEqual([
      ...statusChange("OPEN", "CANCELLED"),
      { field: "cancellationReason", oldValue: null, newValue: "Equipment was replaced" },
    ]);
  });

  it("should record nothing when cancelling a task that is already done", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask({ status: "DONE" });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/cancel`)
      .set(asUser(admin))
      .send({ reason: "Too late" });

    expect(response.status).toBe(409);
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record a deleted task with its old values", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask({ title: "Old job", priority: "HIGH" });

    const response = await request(app).delete(`/api/v1/tasks/${task.id}`).set(asUser(admin));

    expect(response.status).toBe(204);

    const entry = await onlyEntry("TASK");

    expect(entry).toMatchObject({
      action: "DELETE",
      entityId: task.id,
      entityLabel: "Old job",
      userId: admin.id,
    });
    expect(entry.changes).toEqual(
      expect.arrayContaining([
        { field: "title", oldValue: "Old job", newValue: null },
        { field: "priority", oldValue: "HIGH", newValue: null },
      ]),
    );
  });

  it("should not apply a change whose entry cannot be written", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    jest.spyOn(changeLogRepository, "record").mockRejectedValueOnce(new Error("log failed"));

    const response = await request(app).delete(`/api/v1/tasks/${task.id}`).set(asUser(admin));

    expect(response.status).toBe(500);
    expect(await prisma.task.findUnique({ where: { id: task.id } })).not.toBeNull();
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record each in-progress task released when an account is deleted", async () => {
    const tech = await createTechnicianUser();
    await createTestTask({ title: "Job A", assignedTo: tech.id, status: "IN_PROGRESS" });
    await createTestTask({ title: "Job B", assignedTo: tech.id, status: "OPEN" });

    const response = await request(app).delete("/api/v1/users/me").set(asUser(tech));

    expect(response.status).toBe(204);

    const entries = await prisma.changeLog.findMany({ where: { entityType: "TASK" } });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "UPDATE", entityLabel: "Job A" });
    expect(entries[0].changes).toEqual(statusChange("IN_PROGRESS", "OPEN"));
    // The account is gone, but the entry still names who did it.
    expect(entries[0]).toMatchObject({ userId: null, actorLabel: tech.userName });
  });

  it("should record a task generated by a schedule with no user", async () => {
    await createTestRecurringTask({ title: "Replace filter" });

    await generateRecurringTasks();

    const entry = await onlyEntry("TASK");

    expect(entry).toMatchObject({
      action: "CREATE",
      entityLabel: "Replace filter",
      userId: null,
      actorLabel: null,
    });
  });
});
