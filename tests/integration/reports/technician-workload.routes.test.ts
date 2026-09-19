import request from "supertest";

import app from "../../../src/app";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

describe("GET /api/v1/reports/technicians", () => {
  it("should report per-technician task counts and next upcoming due date", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();

    await createTestTask({ assignedTo: tech.id, status: "OPEN" });
    await createTestTask({ assignedTo: tech.id, status: "IN_PROGRESS" });
    await createTestTask({ assignedTo: tech.id, status: "DONE" });
    await createTestTask({
      assignedTo: tech.id,
      status: "OPEN",
      dueDate: new Date("2020-01-01T00:00:00.000Z"), // overdue
    });
    await createTestTask({
      assignedTo: tech.id,
      status: "OPEN",
      dueDate: new Date("2999-01-01T00:00:00.000Z"), // upcoming
    });

    const response = await request(app)
      .get("/api/v1/reports/technicians")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const row = response.body.data.find((r: { id: string }) => r.id === tech.id);
    expect(row).toMatchObject({
      openTasks: 3, // two plain OPEN + the overdue OPEN
      inProgressTasks: 1,
      overdueTasks: 1,
      completedTasks: 1,
    });
    expect(new Date(row.nextDueAt).toISOString()).toBe("2999-01-01T00:00:00.000Z");
  });

  it("should include technicians with no tasks as zero rows", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/reports/technicians")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const row = response.body.data.find((r: { id: string }) => r.id === tech.id);
    expect(row).toMatchObject({ openTasks: 0, overdueTasks: 0, nextDueAt: null });
  });

  it("should only list technicians (not managers or admins)", async () => {
    const admin = await createAdminUser();
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/reports/technicians")
      .set(authHeader(signTestAccessToken(admin)));

    const ids = response.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain(tech.id);
    expect(ids).not.toContain(admin.id);
    expect(ids).not.toContain(manager.id);
  });

  it("should exclude deactivated (INACTIVE) technicians", async () => {
    const admin = await createAdminUser();
    const active = await createTechnicianUser();
    const inactive = await createTechnicianUser({ status: "INACTIVE" });

    const response = await request(app)
      .get("/api/v1/reports/technicians")
      .set(authHeader(signTestAccessToken(admin)));

    const ids = response.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactive.id);
  });

  it("should sort by a chosen metric (overdueTasks desc)", async () => {
    const admin = await createAdminUser();
    const busy = await createTechnicianUser();
    const idle = await createTechnicianUser();

    await createTestTask({
      assignedTo: busy.id,
      status: "OPEN",
      dueDate: new Date("2020-01-01T00:00:00.000Z"),
    });

    const response = await request(app)
      .get("/api/v1/reports/technicians?sortBy=overdueTasks&sortOrder=desc")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data[0].id).toBe(busy.id);
    const idleRow = response.body.data.find((r: { id: string }) => r.id === idle.id);
    expect(idleRow.overdueTasks).toBe(0);
  });

  it("should search by userName", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser({ userName: "sarah_chen" });
    await createTechnicianUser({ userName: "mike_rodriguez" });

    const response = await request(app)
      .get("/api/v1/reports/technicians?search=sarah")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(target.id);
  });

  it("should paginate with meta", async () => {
    const admin = await createAdminUser();
    await createTechnicianUser();
    await createTechnicianUser();
    await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/reports/technicians?limit=2&page=1")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, pages: 2 });
  });

  it("should forbid a TECHNICIAN", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/reports/technicians")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(403);
  });

  it("should return 400 for an invalid sortBy", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/reports/technicians?sortBy=nope")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(400);
  });

  it("should return 401 without a token", async () => {
    const response = await request(app).get("/api/v1/reports/technicians");

    expect(response.status).toBe(401);
  });
});
