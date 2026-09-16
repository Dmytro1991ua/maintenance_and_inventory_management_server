import request from "supertest";

import app from "../../../src/app";
import {
  authHeader,
  createAdminUser,
  createTechnicianUser,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

describe("GET /api/v1/dashboard/stats — manager cycle time", () => {
  it("should compute avgCompletionDays from completedAt, not updatedAt", async () => {
    const admin = await createAdminUser();

    // A completed task with a 4-day cycle (created → completed). updatedAt is
    // "now" (just inserted), so a completedAt-based average is the only way to
    // get 4 here — an updatedAt-based one would be ~0.
    await createTestTask({
      status: "DONE",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      completedAt: new Date("2026-06-05T00:00:00.000Z"),
    });

    const response = await request(app)
      .get("/api/v1/dashboard/stats")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.tasks.avgCompletionDays).toBe(4);
  });

  it("should ignore DONE tasks with no completedAt when averaging", async () => {
    const admin = await createAdminUser();

    // Legacy completed task without a completedAt must not drag the average to 0.
    await createTestTask({
      status: "DONE",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      completedAt: new Date("2026-06-03T00:00:00.000Z"),
    });
    await createTestTask({
      status: "DONE",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      completedAt: null,
    });

    const response = await request(app)
      .get("/api/v1/dashboard/stats")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.tasks.avgCompletionDays).toBe(2);
  });

  it("should return the technician view for a technician (no manager stats)", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/dashboard/stats")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(200);
    expect(response.body.data.myTasks).toBeDefined();
  });
});
