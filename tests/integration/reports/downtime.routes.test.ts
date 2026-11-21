import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { authHeader, createAdminUser, createTestAsset, signTestAccessToken } from "../helpers";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

// An asset registered `days` ago, so its tracked window is known.
const createAssetRegistered = async (days: number, name = "Asset") => {
  const asset = await createTestAsset({ name });

  return prisma.asset.update({ where: { id: asset.id }, data: { createdAt: ago(days * DAY) } });
};

const logDowntime = (
  assetId: string,
  startedMsAgo: number,
  endedMsAgo: number | null,
  reason: "BREAKDOWN" | "PLANNED" = "BREAKDOWN",
) =>
  prisma.assetDowntime.create({
    data: {
      assetId,
      reason,
      startedAt: ago(startedMsAgo),
      endedAt: endedMsAgo === null ? null : ago(endedMsAgo),
    },
  });

const getReport = async (query = "") => {
  const admin = await createAdminUser();

  return request(app)
    .get(`/api/v1/reports/assets${query}`)
    .set(authHeader(signTestAccessToken(admin)));
};

type Row = {
  id: string;
  name: string;
  downtimeMinutes: number;
  breakdowns: number;
  availabilityPercent: number | null;
  mttrMinutes: number | null;
};

const rowFor = async (assetId: string): Promise<Row> =>
  (await getReport()).body.data.find((r: Row) => r.id === assetId);

describe("GET /api/v1/reports/assets — downtime", () => {
  it("should show full availability and no repair time for an asset with no downtime", async () => {
    const asset = await createAssetRegistered(10);

    expect(await rowFor(asset.id)).toMatchObject({
      downtimeMinutes: 0,
      breakdowns: 0,
      availabilityPercent: 100,
      mttrMinutes: null,
    });
  });

  it("should total downtime, count breakdowns, and average the repair time", async () => {
    const asset = await createAssetRegistered(10);
    await logDowntime(asset.id, 5 * DAY, 5 * DAY - 2 * HOUR); // 120 min
    await logDowntime(asset.id, 2 * DAY, 2 * DAY - 4 * HOUR); // 240 min

    const row = await rowFor(asset.id);

    expect(row).toMatchObject({ downtimeMinutes: 360, breakdowns: 2, mttrMinutes: 180 });
    // 360 of 14400 minutes down.
    expect(row.availabilityPercent).toBeCloseTo(97.5, 1);
  });

  it("should count planned downtime against availability but not as a breakdown", async () => {
    const asset = await createAssetRegistered(10);
    await logDowntime(asset.id, 3 * DAY, 3 * DAY - 6 * HOUR, "PLANNED");

    const row = await rowFor(asset.id);

    expect(row).toMatchObject({ downtimeMinutes: 360, breakdowns: 0, mttrMinutes: null });
    expect(row.availabilityPercent).toBeCloseTo(97.5, 1);
  });

  it("should count an ongoing breakdown up to now, with no repair time yet", async () => {
    const asset = await createAssetRegistered(10);
    await logDowntime(asset.id, 3 * HOUR, null);

    const row = await rowFor(asset.id);

    expect(row.downtimeMinutes).toBeGreaterThanOrEqual(179);
    expect(row).toMatchObject({ breakdowns: 1, mttrMinutes: null });
  });

  it("should count only the part of an event after the asset was registered", async () => {
    const asset = await createAssetRegistered(1);
    // Starts 2 days ago (before registration), ends 22 hours ago: 2 hours inside the window.
    await logDowntime(asset.id, 2 * DAY, 22 * HOUR);

    const row = await rowFor(asset.id);

    expect(row.downtimeMinutes).toBe(120);
    // Started before registration, so it is not one of this window's breakdowns.
    expect(row.breakdowns).toBe(0);
  });

  it("should not mix one asset's downtime into another's", async () => {
    const a = await createAssetRegistered(10, "A");
    const b = await createAssetRegistered(10, "B");
    await logDowntime(a.id, 2 * DAY, 2 * DAY - HOUR);

    expect((await rowFor(b.id)).downtimeMinutes).toBe(0);
  });

  it("should agree with the per-asset downtime summary", async () => {
    const asset = await createAssetRegistered(10);
    await logDowntime(asset.id, 6 * DAY, 6 * DAY - 90 * 60 * 1000);
    await logDowntime(asset.id, 3 * DAY, 3 * DAY - 5 * HOUR, "PLANNED");
    await logDowntime(asset.id, 1 * DAY, 1 * DAY - 3 * HOUR);

    const admin = await createAdminUser();
    const { summary } = (
      await request(app)
        .get(`/api/v1/assets/${asset.id}/downtime?from=${asset.createdAt.toISOString()}`)
        .set(authHeader(signTestAccessToken(admin)))
    ).body.data;
    const row = await rowFor(asset.id);

    expect(row.downtimeMinutes).toBe(summary.downtimeMinutes);
    expect(row.breakdowns).toBe(summary.breakdowns);
    expect(row.mttrMinutes).toBe(summary.mttrMinutes);
    expect(row.availabilityPercent).toBeCloseTo(summary.availabilityPercent, 1);
  });

  it("should sort by availability, worst first, and by downtime", async () => {
    await createAssetRegistered(10, "Good");
    const bad = await createAssetRegistered(10, "Bad");
    const middle = await createAssetRegistered(10, "Middle");
    await logDowntime(bad.id, 4 * DAY, 4 * DAY - 10 * HOUR);
    await logDowntime(middle.id, 4 * DAY, 4 * DAY - 2 * HOUR);

    const byAvailability = (await getReport("?sortBy=availabilityPercent&sortOrder=asc")).body;
    const byDowntime = (await getReport("?sortBy=downtimeMinutes&sortOrder=desc")).body;
    const names = (rows: Row[]) => rows.map((r) => r.name);

    expect(names(byAvailability.data)).toEqual(["Bad", "Middle", "Good"]);
    expect(names(byDowntime.data)).toEqual(["Bad", "Middle", "Good"]);
  });

  it("should sort by breakdown count", async () => {
    const one = await createAssetRegistered(10, "One");
    const three = await createAssetRegistered(10, "Three");
    await logDowntime(one.id, 5 * DAY, 5 * DAY - HOUR);
    for (const days of [6, 4, 2]) await logDowntime(three.id, days * DAY, days * DAY - HOUR);

    const { data } = (await getReport("?sortBy=breakdowns&sortOrder=desc")).body;

    expect(data.map((r: Row) => r.name)).toEqual(["Three", "One"]);
  });

  it("should not change the existing columns", async () => {
    const asset = await createAssetRegistered(10);
    await logDowntime(asset.id, 2 * DAY, 2 * DAY - HOUR);

    const row = await rowFor(asset.id);

    expect(row).toMatchObject({ totalTasks: 0, openTasks: 0, partsConsumed: 0, laborMinutes: 0 });
  });
});
