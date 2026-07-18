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

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/v1/tasks", () => {
  it("should return a paginated list for any authenticated role", async () => {
    const technician = await createTechnicianUser();
    await createTestTask();

    const response = await request(app)
      .get("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/tasks");

    expect(response.status).toBe(401);
  });

  it("should filter by status", async () => {
    const technician = await createTechnicianUser();
    await createTestTask({ status: "OPEN" });
    await createTestTask({ status: "DONE" });

    const response = await request(app)
      .get("/api/v1/tasks?status=DONE")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe("DONE");
  });

  it("should filter by search term across title and description", async () => {
    const technician = await createTechnicianUser();
    await createTestTask({ title: "Replace HVAC filter" });
    await createTestTask({ title: "Fix plumbing leak", description: "HVAC room pipe" });
    await createTestTask({ title: "Paint walls" });

    const response = await request(app)
      .get("/api/v1/tasks?search=hvac")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  it("should return only overdue tasks when overdue=true", async () => {
    const technician = await createTechnicianUser();
    await createTestTask({ title: "Overdue task", dueDate: new Date("2020-01-01"), status: "OPEN" });
    await createTestTask({ title: "Future task", dueDate: new Date("2099-01-01"), status: "OPEN" });
    await createTestTask({ title: "Done overdue task", dueDate: new Date("2020-01-01"), status: "DONE" });

    const response = await request(app)
      .get("/api/v1/tasks?overdue=true")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Overdue task");
  });

  it("should filter by assignedTo", async () => {
    const technician = await createTechnicianUser();
    const otherTechnician = await createTechnicianUser();
    await createTestTask({ assignedTo: technician.id });
    await createTestTask({ assignedTo: otherTechnician.id });

    const response = await request(app)
      .get(`/api/v1/tasks?assignedTo=${technician.id}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].assignedTo).toBe(technician.id);
  });
});

describe("GET /api/v1/tasks/:id", () => {
  it("should return the task when it exists", async () => {
    const technician = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .get(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(task.id);
  });

  it("should return 404 when the task does not exist", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/tasks/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/tasks", () => {
  it("should create a task for ADMIN without an assignee", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Replace HVAC filter" });

    expect(response.status).toBe(201);
    expect(response.body.data.assignedTo).toBeNull();
  });

  it("should create a task for MANAGER with a valid assignee", async () => {
    const manager = await createManagerUser();
    const assignee = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(manager)))
      .send({ title: "Replace HVAC filter", assignedTo: assignee.id });

    expect(response.status).toBe(201);
    expect(response.body.data.assignedTo).toBe(assignee.id);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(technician)))
      .send({ title: "Replace HVAC filter" });

    expect(response.status).toBe(403);
  });

  it("should return 404 when the assignee does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Replace HVAC filter", assignedTo: NONEXISTENT_ID });

    expect(response.status).toBe(404);
  });

  it("should return 400 for invalid input", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "" });

    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/v1/tasks/:id", () => {
  it("should allow ADMIN to update any field regardless of assignment", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask({ assignedTo: null });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Updated title" });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Updated title");
  });

  it("should allow ADMIN/MANAGER to reassign to a user that exists", async () => {
    const manager = await createManagerUser();
    const newAssignee = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ assignedTo: newAssignee.id });

    expect(response.status).toBe(200);
    expect(response.body.data.assignedTo).toBe(newAssignee.id);
  });

  it("should return 404 when reassigning to a user that does not exist", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assignedTo: NONEXISTENT_ID });

    expect(response.status).toBe(404);
  });

  it("should allow TECHNICIAN to update status on a task assigned to them", async () => {
    const technician = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: technician.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("IN_PROGRESS");
  });

  it("should return 403 when TECHNICIAN updates a task not assigned to them", async () => {
    const technician = await createTechnicianUser();
    const otherTechnician = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: otherTechnician.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ status: "DONE" });

    expect(response.status).toBe(403);
  });

  it("should return 403 when TECHNICIAN updates a fully unassigned task", async () => {
    const technician = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: null });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ status: "DONE" });

    expect(response.status).toBe(403);
  });

  it("should return 403 when TECHNICIAN sends fields other than status", async () => {
    const technician = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: technician.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ title: "Trying to change title", status: "DONE" });

    expect(response.status).toBe(403);
  });

  it("should return 404 when the task does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/tasks/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Doesn't matter" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/v1/tasks/:id", () => {
  it("should delete the task for ADMIN", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
  });

  it("should return 403 for MANAGER", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(403);
  });

  it("should return 404 when the task does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/tasks/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});
