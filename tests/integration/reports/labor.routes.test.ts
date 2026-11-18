import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createTestAsset,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

type Entry = { minutes: number; workedOn: string; rate?: string | null };

const logLabor = (taskId: string, { minutes, workedOn, rate = null }: Entry) =>
  prisma.taskTimeEntry.create({
    data: { taskId, minutes, workedOn: new Date(workedOn), hourlyRate: rate },
  });

const getReport = async (path: string) => {
  const admin = await createAdminUser();

  return request(app)
    .get(path)
    .set(authHeader(signTestAccessToken(admin)));
};

const getSpend = (query = "from=2026-06-01&to=2026-07-31&groupBy=month") =>
  getReport(`/api/v1/reports/spend?${query}`);

describe("GET /api/v1/reports/spend — labor", () => {
  it("should total the labor logged in the range, costed at the rates logged", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 90, workedOn: "2026-06-10", rate: "40.00" });
    await logLabor(task.id, { minutes: 30, workedOn: "2026-07-02", rate: "20.00" });

    const { labor } = (await getSpend()).body.data;

    expect(labor.summary).toEqual({ minutes: 120, cost: "70.00", unratedMinutes: 0 });
  });

  it("should leave out labor worked outside the range", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 60, workedOn: "2026-05-31", rate: "10.00" });
    await logLabor(task.id, { minutes: 45, workedOn: "2026-06-15", rate: "10.00" });
    await logLabor(task.id, { minutes: 60, workedOn: "2026-08-01", rate: "10.00" });

    const { labor } = (await getSpend()).body.data;

    expect(labor.summary.minutes).toBe(45);
  });

  it("should include both the first and the last day of the range", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 10, workedOn: "2026-06-01", rate: "60.00" });
    await logLabor(task.id, { minutes: 20, workedOn: "2026-07-31", rate: "60.00" });

    const { labor } = (await getSpend()).body.data;

    expect(labor.summary).toMatchObject({ minutes: 30, cost: "30.00" });
  });

  it("should count unrated minutes, but not cost them", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 60, workedOn: "2026-06-10", rate: "30.00" });
    await logLabor(task.id, { minutes: 50, workedOn: "2026-06-11", rate: null });

    const { labor } = (await getSpend()).body.data;

    expect(labor.summary).toEqual({ minutes: 110, cost: "30.00", unratedMinutes: 50 });
  });

  it("should round each entry to the cent and add the rounded costs", async () => {
    const task = await createTestTask();

    for (const day of ["2026-06-01", "2026-06-02", "2026-06-03"]) {
      await logLabor(task.id, { minutes: 10, workedOn: day, rate: "33.33" });
    }

    const { labor } = (await getSpend()).body.data;

    expect(labor.summary.cost).toBe("16.68");
  });

  it("should bucket labor by work date and fill empty buckets with zero", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 60, workedOn: "2026-06-10", rate: "25.00" });
    await logLabor(task.id, { minutes: 120, workedOn: "2026-08-20", rate: "25.00" });

    const { labor } = (await getSpend("from=2026-06-01&to=2026-08-31&groupBy=month")).body.data;

    expect(labor.series).toEqual([
      { bucket: "2026-06-01T00:00:00.000Z", minutes: 60, cost: "25.00" },
      { bucket: "2026-07-01T00:00:00.000Z", minutes: 0, cost: "0.00" },
      { bucket: "2026-08-01T00:00:00.000Z", minutes: 120, cost: "50.00" },
    ]);
  });

  it("should group weekly, with weeks starting on Monday", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 10, workedOn: "2026-06-03", rate: "60.00" }); // Wed
    await logLabor(task.id, { minutes: 20, workedOn: "2026-06-07", rate: "60.00" }); // Sun
    await logLabor(task.id, { minutes: 30, workedOn: "2026-06-08", rate: "60.00" }); // next Mon

    const { labor } = (await getSpend("from=2026-06-01&to=2026-06-14&groupBy=week")).body.data;

    expect(labor.series.map((b: { minutes: number }) => b.minutes)).toEqual([30, 30]);
  });

  it("should add up to the summary", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 35, workedOn: "2026-06-10", rate: "17.00" });
    await logLabor(task.id, { minutes: 25, workedOn: "2026-07-20", rate: "17.00" });

    const { labor } = (await getSpend()).body.data;

    const minutes = labor.series.reduce(
      (sum: number, b: { minutes: number }) => sum + b.minutes,
      0,
    );
    expect(minutes).toBe(labor.summary.minutes);
  });

  it("should return zeros when nothing was logged", async () => {
    const { labor } = (await getSpend()).body.data;

    expect(labor.summary).toEqual({ minutes: 0, cost: "0.00", unratedMinutes: 0 });
    expect(labor.series).toHaveLength(2);
    expect(labor.series.every((b: { cost: string }) => b.cost === "0.00")).toBe(true);
  });

  it("should still count labor on a task that was cancelled afterwards", async () => {
    const task = await createTestTask({ status: "CANCELLED" });
    await logLabor(task.id, { minutes: 60, workedOn: "2026-06-10", rate: "20.00" });

    const { labor } = (await getSpend()).body.data;

    expect(labor.summary).toMatchObject({ minutes: 60, cost: "20.00" });
  });

  it("should keep labor out of the purchasing figures", async () => {
    const task = await createTestTask();
    await logLabor(task.id, { minutes: 600, workedOn: "2026-06-10", rate: "50.00" });

    const { summary, series, labor } = (await getSpend()).body.data;

    expect(labor.summary.cost).toBe("500.00");
    expect(summary).toMatchObject({ spent: "0.00", receivedOrders: 0 });
    expect(series.every((b: { spent: string }) => b.spent === "0.00")).toBe(true);
  });
});

describe("GET /api/v1/reports/assets — labor", () => {
  const rowFor = (rows: { id: string }[], id: string) => rows.find((r) => r.id === id);

  it("should show each asset's logged labor, cost and unrated minutes", async () => {
    const asset = await createTestAsset({ name: "Pump A" });
    const first = await createTestTask({ assetId: asset.id });
    const second = await createTestTask({ assetId: asset.id });
    await logLabor(first.id, { minutes: 90, workedOn: "2026-06-10", rate: "40.00" });
    await logLabor(second.id, { minutes: 30, workedOn: "2026-06-11", rate: "20.00" });
    await logLabor(second.id, { minutes: 15, workedOn: "2026-06-12", rate: null });

    const { data } = (await getReport("/api/v1/reports/assets")).body;

    expect(rowFor(data, asset.id)).toMatchObject({
      laborMinutes: 135,
      laborCost: "70.00",
      laborUnratedMinutes: 15,
    });
  });

  it("should not mix one asset's labor into another's, or count tasks with no asset", async () => {
    const a = await createTestAsset({ name: "Pump A" });
    const b = await createTestAsset({ name: "Pump B" });
    const unlinked = await createTestTask();
    await logLabor((await createTestTask({ assetId: a.id })).id, {
      minutes: 60,
      workedOn: "2026-06-10",
      rate: "10.00",
    });
    await logLabor(unlinked.id, { minutes: 999, workedOn: "2026-06-10", rate: "10.00" });

    const { data } = (await getReport("/api/v1/reports/assets")).body;

    expect(rowFor(data, a.id)).toMatchObject({ laborMinutes: 60, laborCost: "10.00" });
    expect(rowFor(data, b.id)).toMatchObject({
      laborMinutes: 0,
      laborCost: "0.00",
      laborUnratedMinutes: 0,
    });
  });

  it("should not change the existing columns", async () => {
    const asset = await createTestAsset();
    const task = await createTestTask({ assetId: asset.id, status: "DONE" });
    await logLabor(task.id, { minutes: 60, workedOn: "2026-06-10", rate: "10.00" });

    const { data } = (await getReport("/api/v1/reports/assets")).body;

    expect(rowFor(data, asset.id)).toMatchObject({
      totalTasks: 1,
      completedTasks: 1,
      partsConsumed: 0,
    });
  });

  it("should sort by labor cost as a number, not as text", async () => {
    const small = await createTestAsset({ name: "Small" });
    const big = await createTestAsset({ name: "Big" });
    await logLabor((await createTestTask({ assetId: small.id })).id, {
      minutes: 60,
      workedOn: "2026-06-10",
      rate: "9.00",
    });
    await logLabor((await createTestTask({ assetId: big.id })).id, {
      minutes: 60,
      workedOn: "2026-06-10",
      rate: "100.00",
    });

    const desc = (await getReport("/api/v1/reports/assets?sortBy=laborCost&sortOrder=desc")).body;
    const asc = (await getReport("/api/v1/reports/assets?sortBy=laborCost&sortOrder=asc")).body;

    expect(desc.data.map((r: { name: string }) => r.name)).toEqual(["Big", "Small"]);
    expect(asc.data.map((r: { name: string }) => r.name)).toEqual(["Small", "Big"]);
  });

  it("should sort by labor minutes", async () => {
    const few = await createTestAsset({ name: "Few" });
    const many = await createTestAsset({ name: "Many" });
    await logLabor((await createTestTask({ assetId: few.id })).id, {
      minutes: 30,
      workedOn: "2026-06-10",
    });
    await logLabor((await createTestTask({ assetId: many.id })).id, {
      minutes: 300,
      workedOn: "2026-06-10",
    });

    const { data } = (await getReport("/api/v1/reports/assets?sortBy=laborMinutes&sortOrder=desc"))
      .body;

    expect(data.map((r: { name: string }) => r.name)).toEqual(["Many", "Few"]);
  });

  it("should still reject an unknown sort field", async () => {
    const response = await getReport("/api/v1/reports/assets?sortBy=laborNonsense");

    expect(response.status).toBe(400);
  });
});
