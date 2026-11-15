import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

type TestUser = Awaited<ReturnType<typeof createTechnicianUser>>;

const logTime = (taskId: string, user: TestUser, body: object) =>
  request(app)
    .post(`/api/v1/tasks/${taskId}/time-entries`)
    .set(authHeader(signTestAccessToken(user)))
    .send(body);

const listTime = (taskId: string, user: TestUser) =>
  request(app)
    .get(`/api/v1/tasks/${taskId}/time-entries`)
    .set(authHeader(signTestAccessToken(user)));

const setRate = (userId: string, hourlyRate: string | null) =>
  prisma.user.update({ where: { id: userId }, data: { hourlyRate } });

const today = () => new Date().toISOString().slice(0, 10);

describe("POST /api/v1/tasks/:id/time-entries", () => {
  it("should let the assignee log time, without showing rate or cost", async () => {
    const tech = await createTechnicianUser();
    await setRate(tech.id, "20.00");
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await logTime(task.id, tech, { minutes: 90, note: "Replaced belt" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      taskId: task.id,
      minutes: 90,
      note: "Replaced belt",
      workedOn: today(),
      user: { id: tech.id },
    });
    expect(response.body.data).not.toHaveProperty("hourlyRate");
    expect(response.body.data).not.toHaveProperty("cost");
  });

  it("should show the rate and cost to a manager who logs time", async () => {
    const manager = await createManagerUser();
    await setRate(manager.id, "40.00");
    const task = await createTestTask();

    const response = await logTime(task.id, manager, { minutes: 90 });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ hourlyRate: "40.00", cost: "60.00" });
  });

  it("should let an admin log on a task assigned to someone else", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await logTime(task.id, admin, { minutes: 30 });

    expect(response.status).toBe(201);
  });

  it("should reject a technician logging on someone else's task", async () => {
    const tech = await createTechnicianUser();
    const other = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: other.id });

    const response = await logTime(task.id, tech, { minutes: 30 });

    expect(response.status).toBe(403);
    expect(await prisma.taskTimeEntry.count()).toBe(0);
  });

  it("should reject a technician logging on an unassigned task", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask();

    const response = await logTime(task.id, tech, { minutes: 30 });

    expect(response.status).toBe(403);
  });

  it("should still allow logging on a completed task", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id, status: "DONE" });

    const response = await logTime(task.id, tech, { minutes: 30 });

    expect(response.status).toBe(201);
  });

  it("should reject logging on a cancelled task", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask({ status: "CANCELLED" });

    const response = await logTime(task.id, manager, { minutes: 30 });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Cannot log time on a cancelled task");
  });

  it("should accept a past work date", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();

    const response = await logTime(task.id, manager, { minutes: 30, workedOn: "2026-01-05" });

    expect(response.status).toBe(201);
    expect(response.body.data.workedOn).toBe("2026-01-05");
  });

  it("should allow tomorrow (UTC), for users already past midnight, but not later", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();
    const inDays = (days: number) =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const tomorrow = await logTime(task.id, manager, { minutes: 30, workedOn: inDays(1) });
    const later = await logTime(task.id, manager, { minutes: 30, workedOn: inDays(2) });

    expect(tomorrow.status).toBe(201);
    expect(later.status).toBe(400);
    expect(later.body.error.message).toBe("Work date cannot be in the future");
  });

  it.each([
    ["zero minutes", { minutes: 0 }],
    ["more than 24 hours", { minutes: 1441 }],
    ["a fraction of a minute", { minutes: 1.5 }],
    ["no minutes", {}],
    ["a malformed date", { minutes: 30, workedOn: "05/01/2026" }],
    ["an unknown field", { minutes: 30, hourlyRate: "999" }],
    ["a note over 500 characters", { minutes: 30, note: "x".repeat(501) }],
  ])("should reject %s", async (_label, body) => {
    const manager = await createManagerUser();
    const task = await createTestTask();

    const response = await logTime(task.id, manager, body);

    expect(response.status).toBe(400);
    expect(await prisma.taskTimeEntry.count()).toBe(0);
  });

  it("should freeze the rate on each entry, so a raise doesn't change past cost", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id });
    await setRate(tech.id, "20.00");
    await logTime(task.id, tech, { minutes: 60, workedOn: "2026-01-05" });

    await setRate(tech.id, "40.00");
    await logTime(task.id, tech, { minutes: 60, workedOn: "2026-01-06" });

    const { entries, totalCost } = (await listTime(task.id, manager)).body.data;
    expect(entries.map((e: { cost: string }) => e.cost)).toEqual(["20.00", "40.00"]);
    expect(totalCost).toBe("60.00");
  });

  it("should log an entry with no cost when the user has no rate", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();

    const response = await logTime(task.id, manager, { minutes: 45 });

    expect(response.body.data).toMatchObject({ hourlyRate: null, cost: null });
  });

  it("should return 404 for an unknown task", async () => {
    const manager = await createManagerUser();

    const response = await logTime(NONEXISTENT_ID, manager, { minutes: 30 });

    expect(response.status).toBe(404);
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app)
      .post(`/api/v1/tasks/${NONEXISTENT_ID}/time-entries`)
      .send({ minutes: 30 });

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/tasks/:id/time-entries", () => {
  it("should show a technician the entries and total minutes, without cost", async () => {
    const tech = await createTechnicianUser();
    await setRate(tech.id, "20.00");
    const task = await createTestTask({ assignedTo: tech.id });
    await logTime(task.id, tech, { minutes: 30 });
    await logTime(task.id, tech, { minutes: 45 });

    const response = await listTime(task.id, tech);

    expect(response.status).toBe(200);
    expect(response.body.data.totalMinutes).toBe(75);
    expect(response.body.data.entries).toHaveLength(2);
    expect(response.body.data).not.toHaveProperty("totalCost");
    expect(response.body.data).not.toHaveProperty("unratedMinutes");
    expect(response.body.data.entries[0]).not.toHaveProperty("cost");
    expect(response.body.data.entries[0]).not.toHaveProperty("hourlyRate");
  });

  it("should show a manager each cost, the total, and the unrated minutes", async () => {
    const manager = await createManagerUser();
    const rated = await createTechnicianUser();
    const unrated = await createTechnicianUser();
    await setRate(rated.id, "30.00");
    const task = await createTestTask({ assignedTo: rated.id });
    await logTime(task.id, rated, { minutes: 120 });
    await prisma.task.update({ where: { id: task.id }, data: { assignedTo: unrated.id } });
    await logTime(task.id, unrated, { minutes: 50 });

    const { data } = (await listTime(task.id, manager)).body;

    expect(data.totalMinutes).toBe(170);
    expect(data.totalCost).toBe("60.00");
    expect(data.unratedMinutes).toBe(50);
  });

  it("should round each entry to the cent and total the rounded costs", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    await setRate(tech.id, "33.33");
    const task = await createTestTask({ assignedTo: tech.id });

    for (const day of ["2026-01-05", "2026-01-06", "2026-01-07"]) {
      await logTime(task.id, tech, { minutes: 10, workedOn: day });
    }

    const { data } = (await listTime(task.id, manager)).body;
    expect(data.entries.map((e: { cost: string }) => e.cost)).toEqual(["5.56", "5.56", "5.56"]);
    expect(data.totalCost).toBe("16.68");
  });

  it("should list entries by work date", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();
    await logTime(task.id, manager, { minutes: 10, workedOn: "2026-01-07" });
    await logTime(task.id, manager, { minutes: 20, workedOn: "2026-01-05" });

    const { entries } = (await listTime(task.id, manager)).body.data;

    expect(entries.map((e: { workedOn: string }) => e.workedOn)).toEqual([
      "2026-01-05",
      "2026-01-07",
    ]);
  });

  it("should return zero totals for a task with no entries", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();

    const { data } = (await listTime(task.id, manager)).body;

    expect(data).toMatchObject({
      entries: [],
      totalMinutes: 0,
      totalCost: "0.00",
      unratedMinutes: 0,
    });
  });

  it("should only list the entries of the requested task", async () => {
    const manager = await createManagerUser();
    const a = await createTestTask();
    const b = await createTestTask();
    await logTime(a.id, manager, { minutes: 10 });
    await logTime(b.id, manager, { minutes: 99 });

    const { data } = (await listTime(a.id, manager)).body;

    expect(data.totalMinutes).toBe(10);
  });

  it("should keep an entry, and its cost, after the worker's account is deleted", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    await setRate(tech.id, "30.00");
    const task = await createTestTask({ assignedTo: tech.id });
    await logTime(task.id, tech, { minutes: 60 });

    await prisma.user.delete({ where: { id: tech.id } });

    const { data } = (await listTime(task.id, manager)).body;
    expect(data.entries[0]).toMatchObject({ user: null, cost: "30.00" });
    expect(data.totalCost).toBe("30.00");
  });

  it("should return 404 for an unknown task", async () => {
    const manager = await createManagerUser();

    expect((await listTime(NONEXISTENT_ID, manager)).status).toBe(404);
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app).get(`/api/v1/tasks/${NONEXISTENT_ID}/time-entries`);

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/v1/tasks/:id/time-entries/:entryId", () => {
  const remove = (taskId: string, entryId: string, user: TestUser) =>
    request(app)
      .delete(`/api/v1/tasks/${taskId}/time-entries/${entryId}`)
      .set(authHeader(signTestAccessToken(user)));

  const logAs = async (user: TestUser) => {
    const task = await createTestTask({ assignedTo: user.id });
    const response = await logTime(task.id, user, { minutes: 30 });

    return { task, entryId: response.body.data.id as string };
  };

  it("should let the author delete their own entry", async () => {
    const tech = await createTechnicianUser();
    const { task, entryId } = await logAs(tech);

    const response = await remove(task.id, entryId, tech);

    expect(response.status).toBe(204);
    expect(await prisma.taskTimeEntry.count()).toBe(0);
  });

  it("should reject another technician deleting it", async () => {
    const tech = await createTechnicianUser();
    const other = await createTechnicianUser();
    const { task, entryId } = await logAs(tech);

    const response = await remove(task.id, entryId, other);

    expect(response.status).toBe(403);
    expect(await prisma.taskTimeEntry.count()).toBe(1);
  });

  it("should let a manager delete anyone's entry", async () => {
    const tech = await createTechnicianUser();
    const manager = await createManagerUser();
    const { task, entryId } = await logAs(tech);

    const response = await remove(task.id, entryId, manager);

    expect(response.status).toBe(204);
  });

  it("should return 404 when the entry belongs to a different task", async () => {
    const tech = await createTechnicianUser();
    const { entryId } = await logAs(tech);
    const otherTask = await createTestTask();

    const response = await remove(otherTask.id, entryId, tech);

    expect(response.status).toBe(404);
    expect(await prisma.taskTimeEntry.count()).toBe(1);
  });

  it("should return 404 for an unknown entry", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();

    expect((await remove(task.id, NONEXISTENT_ID, manager)).status).toBe(404);
  });

  it("should remove a task's entries along with the task", async () => {
    const tech = await createTechnicianUser();
    const admin = await createAdminUser();
    const { task } = await logAs(tech);

    await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(await prisma.taskTimeEntry.count()).toBe(0);
  });
});
