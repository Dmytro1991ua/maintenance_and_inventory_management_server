import request from "supertest";

import app from "../../../src/app";
import { checkOverdueTasks } from "../../../src/jobs/cron/tasks";
import { authHeader, createManagerUser, createTechnicianUser, signTestAccessToken } from "../../integration/helpers";

describe("task overdue notification flow", () => {
  it("should notify the assignee once a task is overdue, then stop once it's marked done", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();

    const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const createResponse = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(manager)))
      .send({ title: "Replace HVAC filter", assignedTo: technician.id, dueDate: pastDueDate });

    expect(createResponse.status).toBe(201);
    const taskId = createResponse.body.data.id;

    // The scheduled job — not an HTTP endpoint — finds the overdue task and notifies its assignee
    await checkOverdueTasks();

    const unreadAfterFirstRun = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(technician)));

    expect(unreadAfterFirstRun.body.data).toEqual({ count: 1 });

    const notifications = await request(app)
      .get("/api/v1/notifications")
      .set(authHeader(signTestAccessToken(technician)));

    expect(notifications.body.data[0]).toEqual(
      expect.objectContaining({
        type: "TASK_OVERDUE",
        relatedEntityId: taskId,
        message: expect.stringContaining("Replace HVAC filter"),
      }),
    );

    // Technician marks the task done
    const updateResponse = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ status: "DONE" });

    expect(updateResponse.status).toBe(200);

    // The job no longer considers it overdue (status is DONE), so re-running
    // it must not add a second notification.
    await checkOverdueTasks();

    const unreadAfterCompletion = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(technician)));

    expect(unreadAfterCompletion.body.data).toEqual({ count: 1 });
  });
});
