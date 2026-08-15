import request from "supertest";

import app from "../../../src/app";

jest.mock("../../../src/shared/email.service", () => ({
  emailService: { sendTaskAssignment: jest.fn().mockResolvedValue(undefined) },
}));

import { authHeader, signTestAccessToken } from "../helpers/auth.helpers";
import { createTestTask } from "../helpers/task.helpers";
import { createAdminUser, createManagerUser, createTechnicianUser } from "../helpers/user.helpers";

describe("Technician availability — GET /api/v1/users", () => {
  it("should include availability field for all users", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);

    const adminRow = response.body.data.find((u: { id: string }) => u.id === admin.id);
    const techRow = response.body.data.find((u: { id: string }) => u.id === tech.id);

    expect(adminRow.availability).toBeNull();
    expect(techRow.availability).toBe("AVAILABLE");
  });

  it("should return RESERVED when technician has an OPEN task", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    await createTestTask({ assignedTo: tech.id, status: "OPEN" });

    const response = await request(app)
      .get(`/api/v1/users/${tech.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.availability).toBe("RESERVED");
  });

  it("should return BUSY when technician has an IN_PROGRESS task", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    await createTestTask({ assignedTo: tech.id, status: "IN_PROGRESS" });

    const response = await request(app)
      .get(`/api/v1/users/${tech.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.availability).toBe("BUSY");
  });

  it("should return AVAILABLE when technician's only task is DONE", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    await createTestTask({ assignedTo: tech.id, status: "DONE" });

    const response = await request(app)
      .get(`/api/v1/users/${tech.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.availability).toBe("AVAILABLE");
  });

  it("should filter by ?available=true — returns only technicians with no active task", async () => {
    const admin = await createAdminUser();
    const freeTech = await createTechnicianUser();
    const busyTech = await createTechnicianUser();
    await createTestTask({ assignedTo: busyTech.id, status: "IN_PROGRESS" });

    const response = await request(app)
      .get("/api/v1/users?available=true")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const ids = response.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(freeTech.id);
    expect(ids).not.toContain(busyTech.id);
    expect(ids).not.toContain(admin.id);
  });

  it("should exclude admins and managers from ?available=true results", async () => {
    const admin = await createAdminUser();
    const manager = await createManagerUser();

    const response = await request(app)
      .get("/api/v1/users?available=true")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const ids = response.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(admin.id);
    expect(ids).not.toContain(manager.id);
  });
});

describe("Technician availability — POST /api/v1/tasks", () => {
  it("should return 409 when assigning to a technician with an active task", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    await createTestTask({ assignedTo: tech.id, status: "OPEN" });

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Second task", assignedTo: tech.id });

    expect(response.status).toBe(409);
  });

  it("should allow assigning once the previous task is DONE", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    await createTestTask({ assignedTo: tech.id, status: "DONE" });

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Next task", assignedTo: tech.id });

    expect(response.status).toBe(201);
  });
});

describe("Technician availability — PATCH /api/v1/tasks/:id", () => {
  it("should return 409 when re-assigning to a technician who already has an active task", async () => {
    const admin = await createAdminUser();
    const techA = await createTechnicianUser();
    const techB = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: techA.id });
    await createTestTask({ assignedTo: techB.id, status: "IN_PROGRESS" });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assignedTo: techB.id });

    expect(response.status).toBe(409);
  });

  it("should allow keeping the same assignee when updating other fields", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id, status: "OPEN" });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assignedTo: tech.id, title: "Updated title" });

    expect(response.status).toBe(200);
  });
});
