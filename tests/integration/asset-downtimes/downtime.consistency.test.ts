import { randomUUID } from "node:crypto";

import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import type { AssetStatus } from "../../../src/generated/prisma/client";
import { assetDowntimesRepository } from "../../../src/modules/asset-downtimes/asset-downtimes.repository";
import {
  authHeader,
  createManagerUser,
  createTestAsset,
  createTestUser,
  signTestAccessToken,
} from "../helpers";

const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

const statusOf = async (assetId: string) =>
  (await prisma.asset.findUniqueOrThrow({ where: { id: assetId } })).status;

const openEventsOf = (assetId: string) =>
  prisma.assetDowntime.findMany({ where: { assetId, endedAt: null } });

const seedEvent = (assetId: string, startedHoursAgo: number, endedHoursAgo: number | null) =>
  prisma.assetDowntime.create({
    data: {
      assetId,
      reason: "BREAKDOWN",
      startedAt: ago(startedHoursAgo),
      endedAt: endedHoursAgo === null ? null : ago(endedHoursAgo),
    },
  });

describe("POST /api/v1/assets — downtime sync", () => {
  const create = async (status: AssetStatus) =>
    request(app)
      .post("/api/v1/assets")
      .set(authHeader(signTestAccessToken(await createManagerUser())))
      .send({
        name: "New chiller",
        serialNumber: `AST-${randomUUID().slice(0, 8)}`,
        category: "HVAC",
        location: "Roof",
        status,
      });

  it("should open a breakdown for an asset created DOWN", async () => {
    const response = await create("DOWN");

    expect(response.status).toBe(201);
    const open = await openEventsOf(response.body.data.id);
    expect(open).toHaveLength(1);
    expect(open[0].reason).toBe("BREAKDOWN");
  });

  it("should not open an event for an asset created OPERATIONAL", async () => {
    const response = await create("OPERATIONAL");

    expect(await prisma.assetDowntime.count({ where: { assetId: response.body.data.id } })).toBe(0);
  });
});

describe("downtime changes against concurrent edits", () => {
  it("should refuse to start downtime on a retired asset", async () => {
    const asset = await createTestAsset({ status: "RETIRED" });
    const user = await createTestUser();

    const event = await assetDowntimesRepository.start({
      assetId: asset.id,
      reason: "BREAKDOWN",
      startedAt: new Date(),
      createdBy: user.id,
    });

    expect(event).toBeNull();
    expect(await statusOf(asset.id)).toBe("RETIRED");
    expect(await prisma.assetDowntime.count({ where: { assetId: asset.id } })).toBe(0);
  });

  it("should not change a retired asset's status when its event is ended", async () => {
    const asset = await createTestAsset({ status: "RETIRED" });
    const event = await seedEvent(asset.id, 5, null);

    const ended = await assetDowntimesRepository.end(event.id, asset.id, new Date());

    expect(ended?.endedAt).not.toBeNull();
    expect(await statusOf(asset.id)).toBe("RETIRED");
  });

  it("should not change a retired asset's status when its open event is deleted", async () => {
    const asset = await createTestAsset({ status: "RETIRED" });
    const event = await seedEvent(asset.id, 5, null);

    await assetDowntimesRepository.delete(event.id, asset.id);

    expect(await statusOf(asset.id)).toBe("RETIRED");
  });

  it("should end an event only once and keep the first end time", async () => {
    const asset = await createTestAsset({ status: "DOWN" });
    const event = await seedEvent(asset.id, 5, null);
    const firstEnd = ago(3);

    const first = await assetDowntimesRepository.end(event.id, asset.id, firstEnd);
    const second = await assetDowntimesRepository.end(event.id, asset.id, ago(1));

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const stored = await prisma.assetDowntime.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.endedAt).toEqual(firstEnd);
  });

  it("should leave a newer open event and the asset alone when a stale end arrives", async () => {
    const asset = await createTestAsset({ status: "DOWN" });
    const finished = await seedEvent(asset.id, 10, 6);
    const newer = await seedEvent(asset.id, 2, null);

    const result = await assetDowntimesRepository.end(finished.id, asset.id, new Date());

    expect(result).toBeNull();
    expect(await statusOf(asset.id)).toBe("DOWN");
    expect(await openEventsOf(asset.id)).toHaveLength(1);
    expect((await openEventsOf(asset.id))[0].id).toBe(newer.id);
  });

  it("should keep the asset DOWN when an older finished event is deleted", async () => {
    const asset = await createTestAsset({ status: "DOWN" });
    const finished = await seedEvent(asset.id, 10, 6);
    await seedEvent(asset.id, 2, null);

    await assetDowntimesRepository.delete(finished.id, asset.id);

    expect(await statusOf(asset.id)).toBe("DOWN");
  });

  it("should put the asset back in service when its open event is deleted", async () => {
    const asset = await createTestAsset({ status: "DOWN" });
    const event = await seedEvent(asset.id, 5, null);

    await assetDowntimesRepository.delete(event.id, asset.id);

    expect(await statusOf(asset.id)).toBe("OPERATIONAL");
  });
});
