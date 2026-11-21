import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestAsset,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

const as = async (make: typeof createTechnicianUser) =>
  authHeader(signTestAccessToken(await make()));

const path = (assetId: string, rest = "") => `/api/v1/assets/${assetId}/downtime${rest}`;

const startDowntime = async (assetId: string, body: object = {}, make = createTechnicianUser) =>
  request(app)
    .post(path(assetId))
    .set(await as(make))
    .send(body);

const statusOf = async (assetId: string) =>
  (await prisma.asset.findUniqueOrThrow({ where: { id: assetId } })).status;

describe("POST /api/v1/assets/:id/downtime", () => {
  it("should record the event and mark the asset DOWN", async () => {
    const asset = await createTestAsset();

    const response = await startDowntime(asset.id, { note: "Compressor tripped" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      assetId: asset.id,
      reason: "BREAKDOWN",
      endedAt: null,
      note: "Compressor tripped",
    });
    expect(await statusOf(asset.id)).toBe("DOWN");
  });

  it("should accept a backdated start and a planned reason", async () => {
    const asset = await createTestAsset();
    const startedAt = ago(5);

    const response = await startDowntime(asset.id, { reason: "PLANNED", startedAt });

    expect(response.status).toBe(201);
    expect(response.body.data.reason).toBe("PLANNED");
    expect(response.body.data.startedAt).toBe(startedAt);
    expect(response.body.data.durationMinutes).toBeGreaterThanOrEqual(299);
  });

  it("should reject a start in the future", async () => {
    const asset = await createTestAsset();
    const future = new Date(Date.now() + HOUR).toISOString();

    const response = await startDowntime(asset.id, { startedAt: future });

    expect(response.status).toBe(400);
    expect(await statusOf(asset.id)).toBe("OPERATIONAL");
  });

  it("should reject a second open downtime on the same asset", async () => {
    const asset = await createTestAsset();
    await startDowntime(asset.id);

    const response = await startDowntime(asset.id);

    expect(response.status).toBe(409);
  });

  it("should let only one of two simultaneous starts through", async () => {
    const asset = await createTestAsset();

    const responses = await Promise.all([startDowntime(asset.id), startDowntime(asset.id)]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.assetDowntime.count({ where: { assetId: asset.id } })).toBe(1);
  });

  it("should have the database refuse a second ongoing event for an asset", async () => {
    const asset = await createTestAsset();
    const open = { assetId: asset.id, reason: "BREAKDOWN" as const, startedAt: new Date() };
    await prisma.assetDowntime.create({ data: open });

    await expect(prisma.assetDowntime.create({ data: open })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("should reject a retired asset", async () => {
    const asset = await createTestAsset({ status: "RETIRED" });

    const response = await startDowntime(asset.id);

    expect(response.status).toBe(409);
    expect(await statusOf(asset.id)).toBe("RETIRED");
  });

  it("should reject a start before the previous downtime ended", async () => {
    const asset = await createTestAsset();
    await prisma.assetDowntime.create({
      data: {
        assetId: asset.id,
        reason: "BREAKDOWN",
        startedAt: new Date(ago(10)),
        endedAt: new Date(ago(2)),
      },
    });

    const overlapping = await startDowntime(asset.id, { startedAt: ago(3) });
    const after = await startDowntime(asset.id, { startedAt: ago(1) });

    expect(overlapping.status).toBe(409);
    expect(after.status).toBe(201);
  });

  it("should link a task of the same asset and reject a task of another", async () => {
    const asset = await createTestAsset();
    const other = await createTestAsset();
    const task = await createTestTask({ assetId: asset.id });
    const foreign = await createTestTask({ assetId: other.id });

    const mismatch = await startDowntime(asset.id, { taskId: foreign.id });
    const linked = await startDowntime(asset.id, { taskId: task.id });

    expect(mismatch.status).toBe(400);
    expect(linked.status).toBe(201);
    expect(linked.body.data.taskId).toBe(task.id);
  });

  it("should reject an unknown asset, a bad reason and unknown fields", async () => {
    const asset = await createTestAsset();

    const unknown = await startDowntime("00000000-0000-4000-8000-000000000000");
    const badReason = await startDowntime(asset.id, { reason: "FIRE" });
    const extra = await startDowntime(asset.id, { status: "DOWN" });

    expect(unknown.status).toBe(404);
    expect(badReason.status).toBe(400);
    expect(extra.status).toBe(400);
  });

  it("should require authentication", async () => {
    const asset = await createTestAsset();

    const response = await request(app).post(path(asset.id)).send({});

    expect(response.status).toBe(401);
  });
});

describe("POST /api/v1/assets/:id/downtime/:downtimeId/end", () => {
  const openEvent = async (assetId: string, hoursAgo = 4) =>
    (await startDowntime(assetId, { startedAt: ago(hoursAgo) })).body.data;

  const end = async (assetId: string, downtimeId: string, body: object = {}) =>
    request(app)
      .post(path(assetId, `/${downtimeId}/end`))
      .set(await as(createTechnicianUser))
      .send(body);

  it("should close the event and put the asset back to OPERATIONAL", async () => {
    const asset = await createTestAsset();
    const event = await openEvent(asset.id);

    const response = await end(asset.id, event.id);

    expect(response.status).toBe(200);
    expect(response.body.data.endedAt).not.toBeNull();
    expect(response.body.data.durationMinutes).toBeGreaterThanOrEqual(239);
    expect(await statusOf(asset.id)).toBe("OPERATIONAL");
  });

  it("should accept an explicit end time", async () => {
    const asset = await createTestAsset();
    const event = await openEvent(asset.id, 4);

    const response = await end(asset.id, event.id, { endedAt: ago(2) });

    expect(response.body.data.durationMinutes).toBe(120);
  });

  it("should reject an end at or before the start, or in the future", async () => {
    const asset = await createTestAsset();
    const event = await openEvent(asset.id, 4);

    const before = await end(asset.id, event.id, { endedAt: ago(5) });
    const future = await end(asset.id, event.id, {
      endedAt: new Date(Date.now() + HOUR).toISOString(),
    });

    expect(before.status).toBe(400);
    expect(future.status).toBe(400);
    expect(await statusOf(asset.id)).toBe("DOWN");
  });

  it("should reject ending an event twice", async () => {
    const asset = await createTestAsset();
    const event = await openEvent(asset.id);
    await end(asset.id, event.id);

    const response = await end(asset.id, event.id);

    expect(response.status).toBe(409);
  });

  it("should not find an event through another asset", async () => {
    const asset = await createTestAsset();
    const other = await createTestAsset();
    const event = await openEvent(asset.id);

    const response = await end(other.id, event.id);

    expect(response.status).toBe(404);
    expect(await statusOf(asset.id)).toBe("DOWN");
  });
});

describe("DELETE /api/v1/assets/:id/downtime/:downtimeId", () => {
  const remove = async (assetId: string, downtimeId: string, make = createManagerUser) =>
    request(app)
      .delete(path(assetId, `/${downtimeId}`))
      .set(await as(make));

  it("should delete an ongoing event and put the asset back in service", async () => {
    const asset = await createTestAsset();
    const event = (await startDowntime(asset.id)).body.data;

    const response = await remove(asset.id, event.id);

    expect(response.status).toBe(204);
    expect(await prisma.assetDowntime.count({ where: { assetId: asset.id } })).toBe(0);
    expect(await statusOf(asset.id)).toBe("OPERATIONAL");
  });

  it("should leave the asset status alone when deleting a finished event", async () => {
    const asset = await createTestAsset({ status: "DOWN" });
    const event = await prisma.assetDowntime.create({
      data: {
        assetId: asset.id,
        reason: "BREAKDOWN",
        startedAt: new Date(ago(9)),
        endedAt: new Date(ago(8)),
      },
    });

    await remove(asset.id, event.id);

    expect(await statusOf(asset.id)).toBe("DOWN");
  });

  it("should be refused for a technician", async () => {
    const asset = await createTestAsset();
    const event = (await startDowntime(asset.id)).body.data;

    const response = await remove(asset.id, event.id, createTechnicianUser);

    expect(response.status).toBe(403);
    expect(await prisma.assetDowntime.count({ where: { assetId: asset.id } })).toBe(1);
  });

  it("should not delete an event through another asset", async () => {
    const asset = await createTestAsset();
    const other = await createTestAsset();
    const event = (await startDowntime(asset.id)).body.data;

    const response = await remove(other.id, event.id, createAdminUser);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/v1/assets/:id/downtime", () => {
  const getList = async (assetId: string, query = "") =>
    request(app)
      .get(path(assetId) + query)
      .set(await as(createTechnicianUser));

  const seed = (
    assetId: string,
    startedHoursAgo: number,
    endedHoursAgo: number | null,
    reason = "BREAKDOWN" as const,
  ) =>
    prisma.assetDowntime.create({
      data: {
        assetId,
        reason,
        startedAt: new Date(ago(startedHoursAgo)),
        endedAt: endedHoursAgo === null ? null : new Date(ago(endedHoursAgo)),
      },
    });

  it("should list events newest first with a summary", async () => {
    const asset = await createTestAsset();
    await seed(asset.id, 30, 28);
    await seed(asset.id, 10, 6);

    const { data } = (await getList(asset.id)).body;

    expect(data.events.map((e: { durationMinutes: number }) => e.durationMinutes)).toEqual([
      240, 120,
    ]);
    expect(data.summary).toMatchObject({
      breakdowns: 2,
      breakdownMinutes: 360,
      mttrMinutes: 180,
    });
  });

  it("should leave out events outside the range", async () => {
    const asset = await createTestAsset();
    await seed(asset.id, 24 * 40, 24 * 40 - 2);
    await seed(asset.id, 5, 4);

    const { data } = (await getList(asset.id, `?from=${ago(24 * 10)}`)).body;

    expect(data.events).toHaveLength(1);
  });

  it("should include an ongoing event", async () => {
    const asset = await createTestAsset();
    await seed(asset.id, 3, null);

    const { data } = (await getList(asset.id)).body;

    expect(data.events[0].endedAt).toBeNull();
    expect(data.summary.breakdowns).toBe(1);
    expect(data.summary.mttrMinutes).toBeNull();
  });

  it("should reject a range where from is after to", async () => {
    const asset = await createTestAsset();

    const response = await getList(asset.id, "?from=2026-06-10&to=2026-06-01");

    expect(response.status).toBe(400);
  });

  it("should not mix in another asset's events", async () => {
    const asset = await createTestAsset();
    const other = await createTestAsset();
    await seed(other.id, 5, 4);

    const { data } = (await getList(asset.id)).body;

    expect(data.events).toEqual([]);
  });
});

describe("PATCH /api/v1/assets/:id status sync", () => {
  const patchStatus = async (assetId: string, status: string) =>
    request(app)
      .patch(`/api/v1/assets/${assetId}`)
      .set(await as(createManagerUser))
      .send({ status });

  it("should open a breakdown when the status is set to DOWN", async () => {
    const asset = await createTestAsset();

    await patchStatus(asset.id, "DOWN");

    const events = await prisma.assetDowntime.findMany({ where: { assetId: asset.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ reason: "BREAKDOWN", endedAt: null });
  });

  it("should close the open event when the asset is set back to OPERATIONAL", async () => {
    const asset = await createTestAsset();
    await startDowntime(asset.id);

    await patchStatus(asset.id, "OPERATIONAL");

    const events = await prisma.assetDowntime.findMany({ where: { assetId: asset.id } });
    expect(events[0].endedAt).not.toBeNull();
  });

  it("should close the open event when the asset is retired", async () => {
    const asset = await createTestAsset();
    await startDowntime(asset.id);

    await patchStatus(asset.id, "RETIRED");

    const events = await prisma.assetDowntime.findMany({ where: { assetId: asset.id } });
    expect(events[0].endedAt).not.toBeNull();
  });

  it("should not open a second event when one is already open", async () => {
    const asset = await createTestAsset();
    await startDowntime(asset.id);

    await patchStatus(asset.id, "OPERATIONAL");
    await patchStatus(asset.id, "DOWN");

    expect(await prisma.assetDowntime.count({ where: { assetId: asset.id } })).toBe(2);
  });

  it("should do nothing for an edit that does not change the status", async () => {
    const asset = await createTestAsset();

    await patchStatus(asset.id, "OPERATIONAL");

    expect(await prisma.assetDowntime.count({ where: { assetId: asset.id } })).toBe(0);
  });
});
