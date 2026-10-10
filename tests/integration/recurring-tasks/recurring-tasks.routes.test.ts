import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestRecurringTask,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const FIRST_DUE = "2030-01-15T00:00:00.000Z";

const validBody = (overrides: object = {}) => ({
  title: "Replace HVAC filter — Building A",
  intervalDays: 90,
  firstDueAt: FIRST_DUE,
  ...overrides,
});

const create = (token: string, body: object) =>
  request(app).post("/api/v1/recurring-tasks").set(authHeader(token)).send(body);

describe("POST /api/v1/recurring-tasks", () => {
  it("should create a schedule whose first due date is firstDueAt", async () => {
    const manager = await createManagerUser();

    const response = await create(signTestAccessToken(manager), validBody());

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      title: "Replace HVAC filter — Building A",
      intervalDays: 90,
      nextDueAt: FIRST_DUE,
      priority: "MEDIUM",
      isActive: true,
      createdBy: manager.id,
      assignedTo: null,
      assignee: null,
    });
  });

  it("should store the optional fields and expose the assignee", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();

    const response = await create(
      signTestAccessToken(manager),
      validBody({
        description: "Use a MERV-13 unit.",
        priority: "HIGH",
        category: "HVAC",
        assignedTo: technician.id,
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      description: "Use a MERV-13 unit.",
      priority: "HIGH",
      category: "HVAC",
      assignedTo: technician.id,
      assignee: { id: technician.id },
    });
  });

  it("should return 404 for an unknown assignee", async () => {
    const manager = await createManagerUser();

    const response = await create(
      signTestAccessToken(manager),
      validBody({ assignedTo: NONEXISTENT_ID }),
    );

    expect(response.status).toBe(404);
  });

  it.each([
    ["a missing title", { title: undefined }],
    ["an empty title", { title: "" }],
    ["a title over 200 characters", { title: "x".repeat(201) }],
    ["an interval of 0", { intervalDays: 0 }],
    ["an interval over 365", { intervalDays: 366 }],
    ["a fractional interval", { intervalDays: 1.5 }],
    ["an interval sent as a string", { intervalDays: "30" }],
    ["a missing interval", { intervalDays: undefined }],
    ["a missing firstDueAt", { firstDueAt: undefined }],
    ["an unparseable firstDueAt", { firstDueAt: "not-a-date" }],
    ["an invalid priority", { priority: "URGENT" }],
    ["an invalid category", { category: "NOPE" }],
    ["a malformed assignee id", { assignedTo: "not-a-uuid" }],
    ["an unknown field", { color: "red" }],
  ])("should return 400 for %s", async (_label, override) => {
    const manager = await createManagerUser();

    const response = await create(signTestAccessToken(manager), validBody(override));

    expect(response.status).toBe(400);
  });

  it("should forbid a TECHNICIAN and require authentication", async () => {
    const technician = await createTechnicianUser();

    expect((await create(signTestAccessToken(technician), validBody())).status).toBe(403);
    expect((await request(app).post("/api/v1/recurring-tasks").send(validBody())).status).toBe(401);
  });
});

describe("GET /api/v1/recurring-tasks", () => {
  it("should list schedules newest first with pagination meta", async () => {
    const manager = await createManagerUser();
    const older = await createTestRecurringTask({ createdBy: manager.id, title: "Older" });
    const newer = await createTestRecurringTask({ createdBy: manager.id, title: "Newer" });

    const response = await request(app)
      .get("/api/v1/recurring-tasks?limit=1")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
    expect(response.body.data.map((s: { id: string }) => s.id)).toEqual([newer.id]);
    expect(response.body.meta).toMatchObject({ total: 2, page: 1, limit: 1, pages: 2 });
    expect(older.id).not.toBe(newer.id);
  });

  it("should filter by isActive", async () => {
    const manager = await createManagerUser();
    await createTestRecurringTask({ createdBy: manager.id, isActive: true });
    const paused = await createTestRecurringTask({ createdBy: manager.id, isActive: false });

    const response = await request(app)
      .get("/api/v1/recurring-tasks?isActive=false")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
    expect(response.body.data.map((s: { id: string }) => s.id)).toEqual([paused.id]);
  });

  it("should forbid a TECHNICIAN and require authentication", async () => {
    const technician = await createTechnicianUser();

    expect(
      (
        await request(app)
          .get("/api/v1/recurring-tasks")
          .set(authHeader(signTestAccessToken(technician)))
      ).status,
    ).toBe(403);
    expect((await request(app).get("/api/v1/recurring-tasks")).status).toBe(401);
  });
});

describe("GET /api/v1/recurring-tasks/:id", () => {
  it("should return the schedule with its assignee", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();
    const schedule = await createTestRecurringTask({
      createdBy: manager.id,
      assignedTo: technician.id,
    });

    const response = await request(app)
      .get(`/api/v1/recurring-tasks/${schedule.id}`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: schedule.id,
      assignee: { id: technician.id, userName: technician.userName },
    });
  });

  it("should return 404 for an unknown id and 400 for a malformed one", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);

    expect(
      (await request(app).get(`/api/v1/recurring-tasks/${NONEXISTENT_ID}`).set(authHeader(token)))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/v1/recurring-tasks/not-a-uuid").set(authHeader(token))).status,
    ).toBe(400);
  });
});

describe("PATCH /api/v1/recurring-tasks/:id", () => {
  const patch = (token: string, id: string, body: object) =>
    request(app).patch(`/api/v1/recurring-tasks/${id}`).set(authHeader(token)).send(body);

  it("should update fields without touching the next due date", async () => {
    const manager = await createManagerUser();
    const schedule = await createTestRecurringTask({
      createdBy: manager.id,
      intervalDays: 7,
      nextDueAt: new Date(FIRST_DUE),
    });

    const response = await patch(signTestAccessToken(manager), schedule.id, {
      title: "Renamed",
      priority: "HIGH",
      intervalDays: 30,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      title: "Renamed",
      priority: "HIGH",
      intervalDays: 30,
    });
    // Changing the interval only affects the NEXT advance; the pending due date stays.
    expect(response.body.data.nextDueAt).toBe(FIRST_DUE);
  });

  it("should clear the category and unassign the schedule with null", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();
    const schedule = await createTestRecurringTask({
      createdBy: manager.id,
      category: "HVAC",
      assignedTo: technician.id,
    });

    const response = await patch(signTestAccessToken(manager), schedule.id, {
      category: null,
      assignedTo: null,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ category: null, assignedTo: null, assignee: null });
  });

  it("should not allow rescheduling: the due date isn't editable", async () => {
    const manager = await createManagerUser();
    const schedule = await createTestRecurringTask({ createdBy: manager.id });

    const response = await patch(signTestAccessToken(manager), schedule.id, {
      nextDueAt: FIRST_DUE,
    });

    expect(response.status).toBe(400);
  });

  it("should return 404 for an unknown schedule or assignee, and 400 for a bad interval", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const schedule = await createTestRecurringTask({ createdBy: manager.id });

    expect((await patch(token, NONEXISTENT_ID, { title: "X" })).status).toBe(404);
    expect((await patch(token, schedule.id, { assignedTo: NONEXISTENT_ID })).status).toBe(404);
    expect((await patch(token, schedule.id, { intervalDays: 0 })).status).toBe(400);
  });

  it("should forbid a TECHNICIAN", async () => {
    const technician = await createTechnicianUser();
    const schedule = await createTestRecurringTask();

    const response = await patch(signTestAccessToken(technician), schedule.id, { title: "X" });

    expect(response.status).toBe(403);
  });
});

describe("pause and resume", () => {
  const act = (token: string, id: string, action: "pause" | "resume") =>
    request(app).post(`/api/v1/recurring-tasks/${id}/${action}`).set(authHeader(token));

  it("should pause an active schedule and resume a paused one", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const schedule = await createTestRecurringTask({ createdBy: manager.id });

    const paused = await act(token, schedule.id, "pause");
    expect(paused.status).toBe(200);
    expect(paused.body.data.isActive).toBe(false);

    const resumed = await act(token, schedule.id, "resume");
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.isActive).toBe(true);
  });

  it("should return 409 when pausing a paused schedule or resuming an active one", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const active = await createTestRecurringTask({ createdBy: manager.id, isActive: true });
    const paused = await createTestRecurringTask({ createdBy: manager.id, isActive: false });

    expect((await act(token, paused.id, "pause")).status).toBe(409);
    expect((await act(token, active.id, "resume")).status).toBe(409);
  });

  it("should leave the due date alone, so a long pause resumes with a stale one", async () => {
    // Pinned current behaviour: resume only flips isActive.
    const manager = await createManagerUser();
    const stale = new Date("2026-01-05T00:00:00.000Z");
    const schedule = await createTestRecurringTask({
      createdBy: manager.id,
      isActive: false,
      nextDueAt: stale,
    });

    const response = await act(signTestAccessToken(manager), schedule.id, "resume");

    expect(response.body.data.nextDueAt).toBe(stale.toISOString());
  });

  it("should return 404 for an unknown schedule and 403 for a TECHNICIAN", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();
    const schedule = await createTestRecurringTask({ createdBy: manager.id });

    expect((await act(signTestAccessToken(manager), NONEXISTENT_ID, "pause")).status).toBe(404);
    expect((await act(signTestAccessToken(technician), schedule.id, "pause")).status).toBe(403);
  });
});

describe("DELETE /api/v1/recurring-tasks/:id", () => {
  const remove = (token: string, id: string) =>
    request(app).delete(`/api/v1/recurring-tasks/${id}`).set(authHeader(token));

  it("should let an ADMIN delete a schedule while keeping the tasks it generated", async () => {
    const admin = await createAdminUser();
    const schedule = await createTestRecurringTask({ createdBy: admin.id });
    const task = await createTestTask({ title: "Generated earlier" });
    await prisma.task.update({ where: { id: task.id }, data: { recurringTaskId: schedule.id } });

    const response = await remove(signTestAccessToken(admin), schedule.id);

    expect(response.status).toBe(204);
    expect(await prisma.recurringTask.count({ where: { id: schedule.id } })).toBe(0);
    const kept = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(kept.recurringTaskId).toBeNull();
  });

  it("should be ADMIN-only: a MANAGER gets 403", async () => {
    const manager = await createManagerUser();
    const schedule = await createTestRecurringTask({ createdBy: manager.id });

    const response = await remove(signTestAccessToken(manager), schedule.id);

    expect(response.status).toBe(403);
    expect(await prisma.recurringTask.count({ where: { id: schedule.id } })).toBe(1);
  });

  it("should return 404 for an unknown schedule", async () => {
    const admin = await createAdminUser();

    expect((await remove(signTestAccessToken(admin), NONEXISTENT_ID)).status).toBe(404);
  });
});
