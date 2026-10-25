import request from "supertest";

import app from "../../../src/app";
import {
  authHeader,
  createAdminUser,
  createTechnicianUser,
  createTestMeter,
  createTestMeterSchedule,
  createTestRecurringTask,
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

  it("should exclude deactivated technicians from the manager technicians list", async () => {
    const admin = await createAdminUser();
    const active = await createTechnicianUser();
    const inactive = await createTechnicianUser({ status: "INACTIVE" });

    const response = await request(app)
      .get("/api/v1/dashboard/stats")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const ids = response.body.data.technicians.map((t: { id: string }) => t.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactive.id);
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

describe("GET /api/v1/dashboard/stats — schedules", () => {
  const getSchedules = async () => {
    const admin = await createAdminUser();
    const response = await request(app)
      .get("/api/v1/dashboard/stats")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);

    return response.body.data.schedules;
  };

  // Interval 250, next threshold 1000: "due soon" is within 25 of it (10%).
  const meterScheduleAt = async (currentReading: number, isActive = true) => {
    const meter = await createTestMeter({ currentReading });

    return createTestMeterSchedule({
      meterId: meter.id,
      intervalReading: 250,
      firstDueReading: 1000,
      isActive,
    });
  };

  it.each([
    ["well before the threshold", 900, 0],
    ["just outside the window", 974, 0],
    ["exactly at the edge of the window", 975, 1],
    ["at the threshold", 1000, 1],
    ["past the threshold (waiting on an open task)", 1100, 1],
  ])("should count a meter schedule %s", async (_label, reading, expected) => {
    await meterScheduleAt(reading);

    const schedules = await getSchedules();

    expect(schedules.meterDueSoon).toBe(expected);
  });

  it("should not fail on schedules with very large readings", async () => {
    // A truck odometer in metres: a new schedule sits 25,000,000 from its threshold.
    const meter = await createTestMeter({ currentReading: 0 });
    await createTestMeterSchedule({
      meterId: meter.id,
      intervalReading: 25_000_000,
      firstDueReading: 25_000_000,
    });

    const schedules = await getSchedules();

    expect(schedules.meterDueSoon).toBe(0);
  });

  it("should leave out paused meter schedules and time-based ones", async () => {
    await meterScheduleAt(1000, false);
    await createTestRecurringTask({ nextDueAt: new Date("2020-01-01T00:00:00.000Z") });

    const schedules = await getSchedules();

    expect(schedules.meterDueSoon).toBe(0);
  });

  it("should keep meter schedules out of the time-based due-this-week count", async () => {
    await meterScheduleAt(1000);
    await createTestRecurringTask({ nextDueAt: new Date("2020-01-01T00:00:00.000Z") });

    const schedules = await getSchedules();

    expect(schedules).toEqual({ active: 2, dueThisWeek: 1, meterDueSoon: 1 });
  });
});
