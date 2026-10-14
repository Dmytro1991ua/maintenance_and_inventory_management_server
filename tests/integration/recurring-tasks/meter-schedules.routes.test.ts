import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestAsset,
  createTestMeter,
  createTestMeterSchedule,
  createTestRecurringTask,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

const createSchedule = (token: string, body: object) =>
  request(app).post("/api/v1/recurring-tasks").set(authHeader(token)).send(body);

const meterBody = (meterId: string, overrides: object = {}) => ({
  title: "Change engine oil",
  meterId,
  intervalReading: 250,
  ...overrides,
});

describe("creating a meter-triggered schedule", () => {
  it("should create one from a meter, taking the asset from the meter", async () => {
    const manager = await createManagerUser();
    const meter = await createTestMeter({ currentReading: 1240 });

    const response = await createSchedule(
      signTestAccessToken(manager),
      meterBody(meter.id, { firstDueReading: 1250, priority: "HIGH", category: "TOOLS" }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      triggerType: "METER",
      meterId: meter.id,
      meter: { id: meter.id, name: "Engine hours", unit: "hours", currentReading: 1240 },
      intervalReading: 250,
      firstDueReading: 1250,
      nextDueReading: 1250,
      assetId: meter.assetId,
      asset: { id: meter.assetId },
      priority: "HIGH",
      isActive: true,
      // The time-based fields stay empty.
      intervalDays: null,
      nextDueAt: null,
    });
  });

  it("should default the first threshold to the current reading plus one interval", async () => {
    const manager = await createManagerUser();
    const meter = await createTestMeter({ currentReading: 1240 });

    const response = await createSchedule(signTestAccessToken(manager), meterBody(meter.id));

    expect(response.body.data.firstDueReading).toBe(1490);
    expect(response.body.data.nextDueReading).toBe(1490);
  });

  it("should accept a first threshold already behind the meter, without creating a task", async () => {
    const manager = await createManagerUser();
    const meter = await createTestMeter({ currentReading: 1240 });

    const response = await createSchedule(
      signTestAccessToken(manager),
      meterBody(meter.id, { firstDueReading: 1000 }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.nextDueReading).toBe(1000);
    // It fires from the next reading or the nightly sweep, never at creation.
    expect(await prisma.task.count()).toBe(0);
  });

  it("should allow several schedules on one meter", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const meter = await createTestMeter({ currentReading: 0 });

    const oil = await createSchedule(token, meterBody(meter.id, { title: "Oil" }));
    const filter = await createSchedule(
      token,
      meterBody(meter.id, { title: "Filter", intervalReading: 500 }),
    );

    expect([oil.status, filter.status]).toEqual([201, 201]);
  });

  it("should return 404 for an unknown meter or assignee", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const meter = await createTestMeter();

    expect((await createSchedule(token, meterBody(NONEXISTENT_ID))).status).toBe(404);
    expect(
      (await createSchedule(token, meterBody(meter.id, { assignedTo: NONEXISTENT_ID }))).status,
    ).toBe(404);
  });

  it("should reject a default first threshold beyond the largest reading", async () => {
    const manager = await createManagerUser();
    const meter = await createTestMeter({ currentReading: 2_147_483_600 });

    const response = await createSchedule(
      signTestAccessToken(manager),
      meterBody(meter.id, { intervalReading: 1000 }),
    );

    expect(response.status).toBe(400);
  });

  it.each([
    ["an interval of 0", { intervalReading: 0 }],
    ["a fractional interval", { intervalReading: 2.5 }],
    ["an interval above the integer ceiling", { intervalReading: 2_147_483_648 }],
    ["an interval sent as a string", { intervalReading: "250" }],
    ["a missing interval", { intervalReading: undefined }],
    ["a negative first threshold", { firstDueReading: -1 }],
    ["a fractional first threshold", { firstDueReading: 10.5 }],
    ["a malformed meter id", { meterId: "not-a-uuid" }],
    ["time-based fields mixed in", { intervalDays: 30, firstDueAt: "2030-01-01T00:00:00.000Z" }],
    ["an asset id (it comes from the meter)", { assetId: NONEXISTENT_ID }],
    ["an unknown field", { color: "red" }],
  ])("should return 400 for %s", async (_label, override) => {
    const manager = await createManagerUser();
    const meter = await createTestMeter();

    const response = await createSchedule(
      signTestAccessToken(manager),
      meterBody(meter.id, override),
    );

    expect(response.status).toBe(400);
  });

  it("should forbid a TECHNICIAN", async () => {
    const technician = await createTechnicianUser();
    const meter = await createTestMeter();

    const response = await createSchedule(signTestAccessToken(technician), meterBody(meter.id));

    expect(response.status).toBe(403);
  });
});

describe("time-based schedules alongside meter ones", () => {
  it("should still accept the original body, as a TIME schedule", async () => {
    const manager = await createManagerUser();

    const response = await createSchedule(signTestAccessToken(manager), {
      title: "Replace filter",
      intervalDays: 90,
      firstDueAt: "2030-01-15T00:00:00.000Z",
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      triggerType: "TIME",
      intervalDays: 90,
      nextDueAt: "2030-01-15T00:00:00.000Z",
      meterId: null,
      intervalReading: null,
      nextDueReading: null,
      assetId: null,
    });
  });

  it("should let a time-based schedule be tied to an asset, and reject an unknown one", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const asset = await createTestAsset();
    const body = { title: "Inspect", intervalDays: 30, firstDueAt: "2030-01-15T00:00:00.000Z" };

    const linked = await createSchedule(token, { ...body, assetId: asset.id });
    const unknown = await createSchedule(token, { ...body, assetId: NONEXISTENT_ID });

    expect(linked.status).toBe(201);
    expect(linked.body.data).toMatchObject({ assetId: asset.id, asset: { id: asset.id } });
    expect(unknown.status).toBe(404);
  });

  it("should list both kinds together with their trigger type", async () => {
    const manager = await createManagerUser();
    await createTestRecurringTask({ createdBy: manager.id, title: "Time" });
    await createTestMeterSchedule({ createdBy: manager.id, title: "Meter" });

    const response = await request(app)
      .get("/api/v1/recurring-tasks")
      .set(authHeader(signTestAccessToken(manager)));

    const byTitle = Object.fromEntries(
      response.body.data.map((s: { title: string; triggerType: string }) => [s.title, s]),
    );
    expect(byTitle.Time.triggerType).toBe("TIME");
    expect(byTitle.Meter.triggerType).toBe("METER");
    expect(byTitle.Meter.nextDueAt).toBeNull();
    expect(byTitle.Time.nextDueReading).toBeNull();
  });
});

describe("updating schedules", () => {
  const patch = (token: string, id: string, body: object) =>
    request(app).patch(`/api/v1/recurring-tasks/${id}`).set(authHeader(token)).send(body);

  it("should let a meter schedule's general fields change", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();
    const schedule = await createTestMeterSchedule({ createdBy: manager.id });

    const response = await patch(signTestAccessToken(manager), schedule.id, {
      title: "Renamed",
      priority: "HIGH",
      assignedTo: technician.id,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      title: "Renamed",
      priority: "HIGH",
      assignedTo: technician.id,
    });
  });

  it("should accept a meter schedule's unchanged assetId, as an edit form resends it", async () => {
    const manager = await createManagerUser();
    const schedule = await createTestMeterSchedule({ createdBy: manager.id });

    const response = await patch(signTestAccessToken(manager), schedule.id, {
      title: "Renamed",
      assetId: schedule.assetId,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ title: "Renamed", assetId: schedule.assetId });
  });

  it.each([
    ["intervalDays (time-based only)", { intervalDays: 30 }],
    ["assetId (taken from the meter)", { assetId: NONEXISTENT_ID }],
    ["intervalReading (fixed once created)", { intervalReading: 100 }],
    ["meterId (fixed once created)", { meterId: NONEXISTENT_ID }],
  ])("should return 400 when a meter schedule is sent %s", async (_label, body) => {
    const manager = await createManagerUser();
    const schedule = await createTestMeterSchedule({ createdBy: manager.id });

    const response = await patch(signTestAccessToken(manager), schedule.id, body);

    expect(response.status).toBe(400);
    const stored = await prisma.recurringTask.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.intervalReading).toBe(250);
  });

  it("should let a time-based schedule be linked to, and unlinked from, an asset", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const asset = await createTestAsset();
    const schedule = await createTestRecurringTask({ createdBy: manager.id });

    const linked = await patch(token, schedule.id, { assetId: asset.id });
    expect(linked.body.data.assetId).toBe(asset.id);

    const unlinked = await patch(token, schedule.id, { assetId: null });
    expect(unlinked.body.data).toMatchObject({ assetId: null, asset: null });

    expect((await patch(token, schedule.id, { assetId: NONEXISTENT_ID })).status).toBe(404);
  });
});

describe("the one-trigger-style database constraint", () => {
  const base = async () => ({ title: "X", createdBy: (await createManagerUser()).id });

  it.each([
    [
      "a TIME schedule with no interval",
      () => ({ triggerType: "TIME" as const, nextDueAt: new Date() }),
    ],
    ["a TIME schedule with no due date", () => ({ triggerType: "TIME" as const, intervalDays: 7 })],
    [
      "a METER schedule with no meter",
      () => ({
        triggerType: "METER" as const,
        intervalReading: 100,
        firstDueReading: 100,
        nextDueReading: 100,
      }),
    ],
  ])("should reject %s", async (_label, fields) => {
    const data = { ...(await base()), ...fields() };

    await expect(prisma.recurringTask.create({ data })).rejects.toThrow();
  });

  it("should reject a TIME schedule that also carries meter fields", async () => {
    const meter = await createTestMeter();

    await expect(
      prisma.recurringTask.create({
        data: {
          ...(await base()),
          triggerType: "TIME",
          intervalDays: 7,
          nextDueAt: new Date(),
          meterId: meter.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("should reject a METER schedule that also carries time fields, or a zero interval", async () => {
    const meter = await createTestMeter();
    const meterFields = {
      triggerType: "METER" as const,
      meterId: meter.id,
      firstDueReading: 100,
      nextDueReading: 100,
    };

    await expect(
      prisma.recurringTask.create({
        data: { ...(await base()), ...meterFields, intervalReading: 100, intervalDays: 7 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.recurringTask.create({
        data: { ...(await base()), ...meterFields, intervalReading: 0 },
      }),
    ).rejects.toThrow();
  });
});

describe("deleting what a meter schedule depends on", () => {
  it("should refuse to delete a meter that triggers a schedule, until the schedule is gone", async () => {
    const admin = await createAdminUser();
    const token = signTestAccessToken(admin);
    const schedule = await createTestMeterSchedule({ createdBy: admin.id });

    const refused = await request(app)
      .delete(`/api/v1/meters/${schedule.meterId}`)
      .set(authHeader(token));
    expect(refused.status).toBe(409);
    expect(await prisma.meter.count({ where: { id: schedule.meterId! } })).toBe(1);

    await request(app).delete(`/api/v1/recurring-tasks/${schedule.id}`).set(authHeader(token));
    const allowed = await request(app)
      .delete(`/api/v1/meters/${schedule.meterId}`)
      .set(authHeader(token));
    expect(allowed.status).toBe(204);
  });

  it("should refuse to delete an asset whose meters trigger a schedule", async () => {
    const admin = await createAdminUser();
    const schedule = await createTestMeterSchedule({ createdBy: admin.id });

    const response = await request(app)
      .delete(`/api/v1/assets/${schedule.assetId}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(409);
    expect(await prisma.asset.count({ where: { id: schedule.assetId! } })).toBe(1);
    expect(await prisma.meter.count({ where: { id: schedule.meterId! } })).toBe(1);
  });

  it("should still delete an asset whose meters have no schedules", async () => {
    const admin = await createAdminUser();
    const meter = await createTestMeter();

    const response = await request(app)
      .delete(`/api/v1/assets/${meter.assetId}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
  });
});
