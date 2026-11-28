import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { assetDowntimesRepository } from "../../../src/modules/asset-downtimes/asset-downtimes.repository";
import {
  asUser,
  createAdminUser,
  createManagerUser,
  createTestAsset,
  onlyEntry,
  statusChange,
} from "../helpers";

type TestUser = Awaited<ReturnType<typeof createAdminUser>>;

const patchAsset = (user: TestUser, id: string, body: object) =>
  request(app).patch(`/api/v1/assets/${id}`).set(asUser(user)).send(body);

const startDowntime = (user: TestUser, assetId: string, body: object = { reason: "BREAKDOWN" }) =>
  request(app).post(`/api/v1/assets/${assetId}/downtime`).set(asUser(user)).send(body);

const endDowntime = (user: TestUser, assetId: string, downtimeId: string) =>
  request(app)
    .post(`/api/v1/assets/${assetId}/downtime/${downtimeId}/end`)
    .set(asUser(user))
    .send({});

const deleteDowntime = (user: TestUser, assetId: string, downtimeId: string) =>
  request(app).delete(`/api/v1/assets/${assetId}/downtime/${downtimeId}`).set(asUser(user));

// Setup goes through the API too; the log is cleared so a test sees only its own action.
const clearLog = () => prisma.changeLog.deleteMany();

afterEach(() => jest.restoreAllMocks());

describe("change log — assets", () => {
  it("should record who created an asset and its filled-in fields", async () => {
    const manager = await createManagerUser();

    const response = await request(app).post("/api/v1/assets").set(asUser(manager)).send({
      name: "Sump Pump",
      serialNumber: "PUMP-1",
      category: "PLUMBING",
      location: "Basement",
    });

    expect(response.status).toBe(201);

    const entry = await onlyEntry("ASSET");

    expect(entry).toMatchObject({
      action: "CREATE",
      entityId: response.body.data.id,
      entityLabel: "Sump Pump",
      userId: manager.id,
      actorLabel: manager.userName,
    });
    expect(entry.changes).toEqual([
      { field: "name", oldValue: null, newValue: "Sump Pump" },
      { field: "serialNumber", oldValue: null, newValue: "PUMP-1" },
      { field: "category", oldValue: null, newValue: "PLUMBING" },
      { field: "location", oldValue: null, newValue: "Basement" },
      { field: "status", oldValue: null, newValue: "OPERATIONAL" },
    ]);
    expect(await prisma.changeLog.count({ where: { entityType: "ASSET_DOWNTIME" } })).toBe(0);
  });

  it("should record the breakdown event too when an asset is created DOWN", async () => {
    const manager = await createManagerUser();

    const response = await request(app).post("/api/v1/assets").set(asUser(manager)).send({
      name: "Press",
      serialNumber: "PRESS-1",
      category: "PLUMBING",
      location: "Hall",
      status: "DOWN",
    });

    const event = await onlyEntry("ASSET_DOWNTIME");

    expect(event).toMatchObject({
      action: "CREATE",
      entityLabel: "Press",
      userId: manager.id,
    });
    expect(event.changes).toEqual(
      expect.arrayContaining([
        { field: "assetId", oldValue: null, newValue: response.body.data.id },
        { field: "reason", oldValue: null, newValue: "BREAKDOWN" },
      ]),
    );
  });

  it("should record only the fields an edit changed, with old and new values", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset({ name: "Pump", location: "Dock A" });

    const response = await patchAsset(manager, asset.id, { name: "Pump", location: "Dock B" });

    expect(response.status).toBe(200);

    const entry = await onlyEntry("ASSET");

    expect(entry).toMatchObject({
      action: "UPDATE",
      entityId: asset.id,
      entityLabel: "Pump",
      userId: manager.id,
    });
    expect(entry.changes).toEqual([{ field: "location", oldValue: "Dock A", newValue: "Dock B" }]);
  });

  it("should record a changed warranty date as a date", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();

    await patchAsset(manager, asset.id, { warrantyExpiresAt: "2027-01-31" });

    expect((await onlyEntry("ASSET")).changes).toEqual([
      { field: "warrantyExpiresAt", oldValue: null, newValue: "2027-01-31T00:00:00.000Z" },
    ]);
  });

  it("should record nothing when an edit changes nothing", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset({ location: "Dock A" });

    const response = await patchAsset(manager, asset.id, { location: "Dock A" });

    expect(response.status).toBe(200);
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record nothing for a rejected edit", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();

    const response = await patchAsset(manager, asset.id, { status: "NOT_A_STATUS" });

    expect(response.status).toBe(400);
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record the status change and the breakdown it opens, then the repair", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset({ name: "Boiler" });

    await patchAsset(admin, asset.id, { status: "DOWN" });

    const down = await onlyEntry("ASSET");
    const opened = await onlyEntry("ASSET_DOWNTIME");

    expect(down.changes).toEqual(statusChange("OPERATIONAL", "DOWN"));
    expect(opened).toMatchObject({ action: "CREATE", entityLabel: "Boiler", userId: admin.id });
    expect(down.userId).toBe(admin.id);

    await clearLog();
    await patchAsset(admin, asset.id, { status: "OPERATIONAL" });

    const up = await onlyEntry("ASSET");
    const closed = await onlyEntry("ASSET_DOWNTIME");

    expect(up.changes).toEqual(statusChange("DOWN", "OPERATIONAL"));
    expect(closed).toMatchObject({ action: "UPDATE", entityId: opened.entityId, userId: admin.id });
    expect(closed.changes).toEqual([
      { field: "endedAt", oldValue: null, newValue: expect.any(String) },
    ]);
  });

  it("should leave no entry when the edit fails after the entry was written", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset({ name: "Pump" });

    jest
      .spyOn(assetDowntimesRepository, "syncWithStatus")
      .mockRejectedValueOnce(new Error("sync failed"));

    const response = await patchAsset(manager, asset.id, { name: "Renamed", status: "DOWN" });

    expect(response.status).toBe(500);
    expect(await prisma.changeLog.count()).toBe(0);
    expect(await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })).toMatchObject({
      name: "Pump",
      status: "OPERATIONAL",
    });
  });

  it("should record a deleted asset with its old values", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset({ name: "Old Chiller", location: "Roof" });

    const response = await request(app).delete(`/api/v1/assets/${asset.id}`).set(asUser(admin));

    expect(response.status).toBe(204);

    const entry = await onlyEntry("ASSET");

    expect(entry).toMatchObject({
      action: "DELETE",
      entityId: asset.id,
      entityLabel: "Old Chiller",
      userId: admin.id,
    });
    expect(entry.changes).toEqual(
      expect.arrayContaining([
        { field: "name", oldValue: "Old Chiller", newValue: null },
        { field: "location", oldValue: "Roof", newValue: null },
      ]),
    );
  });
});

describe("change log — asset downtime", () => {
  it("should record a started event and the asset going DOWN, both under the user", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset({ name: "Lift 2" });

    const response = await startDowntime(manager, asset.id, {
      reason: "BREAKDOWN",
      note: "Belt snapped",
    });

    expect(response.status).toBe(201);

    const event = await onlyEntry("ASSET_DOWNTIME");
    const assetEntry = await onlyEntry("ASSET");

    expect(event).toMatchObject({
      action: "CREATE",
      entityId: response.body.data.id,
      entityLabel: "Lift 2",
      userId: manager.id,
    });
    expect(event.changes).toEqual(
      expect.arrayContaining([
        { field: "assetId", oldValue: null, newValue: asset.id },
        { field: "reason", oldValue: null, newValue: "BREAKDOWN" },
        { field: "note", oldValue: null, newValue: "Belt snapped" },
      ]),
    );
    expect(assetEntry).toMatchObject({ entityId: asset.id, userId: manager.id });
    expect(assetEntry.changes).toEqual(statusChange("OPERATIONAL", "DOWN"));
  });

  it("should record an ended event and the asset returning to service", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset({ name: "Lift 2" });
    const started = await startDowntime(manager, asset.id);

    await clearLog();
    const response = await endDowntime(manager, asset.id, started.body.data.id);

    expect(response.status).toBe(200);

    const event = await onlyEntry("ASSET_DOWNTIME");
    const assetEntry = await onlyEntry("ASSET");

    expect(event).toMatchObject({
      action: "UPDATE",
      entityId: started.body.data.id,
      entityLabel: "Lift 2",
      userId: manager.id,
    });
    expect(event.changes).toEqual([
      { field: "endedAt", oldValue: null, newValue: expect.any(String) },
    ]);
    expect(assetEntry.changes).toEqual(statusChange("DOWN", "OPERATIONAL"));
  });

  it("should record nothing when an already ended event is ended again", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();
    const started = await startDowntime(manager, asset.id);

    await endDowntime(manager, asset.id, started.body.data.id);
    await clearLog();

    const again = await endDowntime(manager, asset.id, started.body.data.id);

    expect(again.status).toBe(409);
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record nothing when downtime cannot start because the asset is retired", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset({ status: "RETIRED" });

    const response = await startDowntime(manager, asset.id);

    expect(response.status).toBe(409);
    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record a deleted ongoing event and the asset returning to service", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset({ name: "Lift 2" });
    const started = await startDowntime(admin, asset.id);

    await clearLog();
    const response = await deleteDowntime(admin, asset.id, started.body.data.id);

    expect(response.status).toBe(204);

    const event = await onlyEntry("ASSET_DOWNTIME");
    const assetEntry = await onlyEntry("ASSET");

    expect(event).toMatchObject({
      action: "DELETE",
      entityId: started.body.data.id,
      entityLabel: "Lift 2",
      userId: admin.id,
    });
    expect(event.changes).toEqual(
      expect.arrayContaining([{ field: "reason", oldValue: "BREAKDOWN", newValue: null }]),
    );
    expect(assetEntry.changes).toEqual(statusChange("DOWN", "OPERATIONAL"));
  });

  it("should record only the event when a finished event is deleted", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();
    const event = await prisma.assetDowntime.create({
      data: {
        assetId: asset.id,
        reason: "PLANNED",
        startedAt: new Date(Date.now() - 4 * 3_600_000),
        endedAt: new Date(Date.now() - 2 * 3_600_000),
      },
    });

    const response = await deleteDowntime(admin, asset.id, event.id);

    expect(response.status).toBe(204);
    expect((await onlyEntry("ASSET_DOWNTIME")).action).toBe("DELETE");
    expect(await prisma.changeLog.count({ where: { entityType: "ASSET" } })).toBe(0);
  });
});
