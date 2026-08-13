import request from "supertest";

import app from "../../../src/app";

jest.mock("../../../src/shared/email.service", () => ({
  emailService: {
    sendTaskAssignment: jest.fn().mockResolvedValue(undefined),
  },
}));

import { emailService } from "../../../src/shared/email.service";
const sendTaskAssignmentMock = emailService.sendTaskAssignment as jest.MockedFunction<
  typeof emailService.sendTaskAssignment
>;

import { authHeader, signTestAccessToken } from "../helpers/auth.helpers";
import { createTestTask } from "../helpers/task.helpers";
import { createAdminUser, createManagerUser, createTechnicianUser } from "../helpers/user.helpers";

afterEach(() => {
  jest.clearAllMocks();
});

describe("Task assignment email — POST /api/v1/tasks", () => {
  it("should send an assignment email to the assignee on create", async () => {
    const admin = await createAdminUser();
    const assignee = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Fix boiler", assignedTo: assignee.id });

    expect(response.status).toBe(201);
    expect(sendTaskAssignmentMock).toHaveBeenCalledTimes(1);
    expect(sendTaskAssignmentMock).toHaveBeenCalledWith(
      assignee.email,
      expect.objectContaining({ id: response.body.data.id, title: "Fix boiler" }),
    );
  });

  it("should not send an email when created without an assignee", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Fix boiler" });

    expect(response.status).toBe(201);
    expect(sendTaskAssignmentMock).not.toHaveBeenCalled();
  });
});

describe("Task assignment email — PATCH /api/v1/tasks/:id", () => {
  it("should send an email when assigning a previously unassigned task", async () => {
    const admin = await createAdminUser();
    const assignee = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assignedTo: assignee.id });

    expect(response.status).toBe(200);
    expect(sendTaskAssignmentMock).toHaveBeenCalledTimes(1);
    expect(sendTaskAssignmentMock).toHaveBeenCalledWith(
      assignee.email,
      expect.objectContaining({ id: task.id }),
    );
  });

  it("should send an email to the new assignee when reassigning", async () => {
    const manager = await createManagerUser();
    const oldAssignee = await createTechnicianUser();
    const newAssignee = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: oldAssignee.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ assignedTo: newAssignee.id });

    expect(response.status).toBe(200);
    expect(sendTaskAssignmentMock).toHaveBeenCalledTimes(1);
    expect(sendTaskAssignmentMock).toHaveBeenCalledWith(
      newAssignee.email,
      expect.objectContaining({ id: task.id }),
    );
  });

  it("should not send an email when the assignee is unchanged", async () => {
    const manager = await createManagerUser();
    const assignee = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: assignee.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ assignedTo: assignee.id });

    expect(response.status).toBe(200);
    expect(sendTaskAssignmentMock).not.toHaveBeenCalled();
  });

  it("should not send an email on a status-only update", async () => {
    const manager = await createManagerUser();
    const task = await createTestTask();

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(200);
    expect(sendTaskAssignmentMock).not.toHaveBeenCalled();
  });

  it("should not send an email when the task is unassigned", async () => {
    const manager = await createManagerUser();
    const assignee = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: assignee.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ assignedTo: null });

    expect(response.status).toBe(200);
    expect(sendTaskAssignmentMock).not.toHaveBeenCalled();
  });
});
