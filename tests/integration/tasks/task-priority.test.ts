import request from "supertest";

import app from "../../../src/app";

jest.mock("../../../src/shared/email.service", () => ({
  emailService: { sendTaskAssignment: jest.fn().mockResolvedValue(undefined) },
}));

import { authHeader, signTestAccessToken } from "../helpers/auth.helpers";
import { createTestTask } from "../helpers/task.helpers";
import { createAdminUser, createManagerUser, createTechnicianUser } from "../helpers/user.helpers";

describe("Task priority — POST /api/v1/tasks", () => {
  it("should default to MEDIUM when priority is not provided", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Fix boiler" });

    expect(response.status).toBe(201);
    expect(response.body.data.priority).toBe("MEDIUM");
  });

  it("should create a task with HIGH priority", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Urgent repair", priority: "HIGH" });

    expect(response.status).toBe(201);
    expect(response.body.data.priority).toBe("HIGH");
  });

  it("should create a task with LOW priority", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(manager)))
      .send({ title: "Paint touch-up", priority: "LOW" });

    expect(response.status).toBe(201);
    expect(response.body.data.priority).toBe("LOW");
  });

  it("should return 400 for an invalid priority value", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Fix boiler", priority: "CRITICAL" });

    expect(response.status).toBe(400);
  });
});

describe("Task priority — PATCH /api/v1/tasks/:id", () => {
  it("should allow ADMIN to change priority", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask({ priority: "LOW" });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ priority: "HIGH" });

    expect(response.status).toBe(200);
    expect(response.body.data.priority).toBe("HIGH");
  });

  it("should allow MANAGER to change priority", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask({ priority: "MEDIUM" });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ priority: "LOW" });

    expect(response.status).toBe(200);
    expect(response.body.data.priority).toBe("LOW");
  });

  it("should return 403 when TECHNICIAN attempts to change priority", async () => {
    const technician = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: technician.id, priority: "LOW" });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ priority: "HIGH" });

    expect(response.status).toBe(403);
  });

  it("should return 400 for an invalid priority value", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ priority: "URGENT" });

    expect(response.status).toBe(400);
  });
});

describe("Task priority — GET /api/v1/tasks (filter + sort)", () => {
  it("should filter by priority", async () => {
    const admin = await createAdminUser();
    await createTestTask({ title: "High task", priority: "HIGH" });
    await createTestTask({ title: "Low task", priority: "LOW" });
    await createTestTask({ title: "Medium task", priority: "MEDIUM" });

    const response = await request(app)
      .get("/api/v1/tasks?priority=HIGH")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].priority).toBe("HIGH");
  });

  it("should return 400 for an invalid priority filter value", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/tasks?priority=CRITICAL")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(400);
  });

  it("should sort by priority ascending (LOW → MEDIUM → HIGH)", async () => {
    const admin = await createAdminUser();
    await createTestTask({ title: "High task", priority: "HIGH" });
    await createTestTask({ title: "Low task", priority: "LOW" });
    await createTestTask({ title: "Medium task", priority: "MEDIUM" });

    const response = await request(app)
      .get("/api/v1/tasks?sortBy=priority&sortOrder=asc")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const priorities = response.body.data.map((t: { priority: string }) => t.priority);
    expect(priorities).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });
});
