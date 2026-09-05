import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestAsset,
  createTestInventoryItem,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

describe("GET /api/v1/reports/assets", () => {
  it("should report per-asset task counts, parts consumed, and avg completion time", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();
    const item = await createTestInventoryItem({ serialNumber: "RPT-PART-1" });

    // One completed task (4-day cycle) with parts, one overdue open task.
    const done = await createTestTask({
      assetId: asset.id,
      status: "DONE",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      completedAt: new Date("2026-06-05T00:00:00.000Z"),
    });
    await prisma.taskPartUsage.create({
      data: { taskId: done.id, inventoryItemId: item.id, quantity: 3 },
    });
    await createTestTask({
      assetId: asset.id,
      status: "OPEN",
      dueDate: new Date("2020-01-01T00:00:00.000Z"),
    });

    const response = await request(app)
      .get("/api/v1/reports/assets")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const row = response.body.data.find((r: { id: string }) => r.id === asset.id);
    expect(row).toMatchObject({
      totalTasks: 2,
      openTasks: 1,
      overdueTasks: 1,
      completedTasks: 1,
      partsConsumed: 3,
      avgCompletionDays: 4,
    });
  });

  it("should include assets with no tasks as zero rows", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .get("/api/v1/reports/assets")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    const row = response.body.data.find((r: { id: string }) => r.id === asset.id);
    expect(row).toMatchObject({
      totalTasks: 0,
      partsConsumed: 0,
      avgCompletionDays: null,
    });
  });

  it("should allow a MANAGER", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .get("/api/v1/reports/assets")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
  });

  it("should forbid a TECHNICIAN", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/reports/assets")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(403);
  });

  it("should return 401 without a token", async () => {
    const response = await request(app).get("/api/v1/reports/assets");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/reports/assets — pagination, search, filters, sort", () => {
  it("should paginate with meta", async () => {
    const admin = await createAdminUser();
    await createTestAsset();
    await createTestAsset();
    await createTestAsset();

    const page1 = await request(app)
      .get("/api/v1/reports/assets?limit=2&page=1")
      .set(authHeader(signTestAccessToken(admin)));

    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, pages: 2 });

    const page2 = await request(app)
      .get("/api/v1/reports/assets?limit=2&page=2")
      .set(authHeader(signTestAccessToken(admin)));

    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta.page).toBe(2);
  });

  it("should not overlap rows across pages when the sort metric ties", async () => {
    const admin = await createAdminUser();
    // All three have zero tasks → totalTasks all tie at 0; the id/name
    // tiebreaker must keep paging stable (no row appears on both pages).
    await createTestAsset();
    await createTestAsset();
    await createTestAsset();

    const p1 = await request(app)
      .get("/api/v1/reports/assets?limit=2&page=1&sortBy=totalTasks")
      .set(authHeader(signTestAccessToken(admin)));
    const p2 = await request(app)
      .get("/api/v1/reports/assets?limit=2&page=2&sortBy=totalTasks")
      .set(authHeader(signTestAccessToken(admin)));

    const ids = [...p1.body.data, ...p2.body.data].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("should search by name, serial, or location", async () => {
    const admin = await createAdminUser();
    await createTestAsset({ name: "Forklift", serialNumber: "RPT-VEH-1" });
    await createTestAsset({ name: "Boiler", serialNumber: "RPT-HVAC-1" });

    const response = await request(app)
      .get("/api/v1/reports/assets?search=forklift")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].serialNumber).toBe("RPT-VEH-1");
  });

  it("should filter by category and status", async () => {
    const admin = await createAdminUser();
    await createTestAsset({ category: "HVAC", status: "OPERATIONAL", serialNumber: "RPT-1" });
    await createTestAsset({ category: "VEHICLE", status: "DOWN", serialNumber: "RPT-2" });

    const byCategory = await request(app)
      .get("/api/v1/reports/assets?category=VEHICLE")
      .set(authHeader(signTestAccessToken(admin)));
    expect(byCategory.body.data).toHaveLength(1);
    expect(byCategory.body.data[0].serialNumber).toBe("RPT-2");

    const byStatus = await request(app)
      .get("/api/v1/reports/assets?status=OPERATIONAL")
      .set(authHeader(signTestAccessToken(admin)));
    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.data[0].serialNumber).toBe("RPT-1");
  });

  it("should sort by a computed metric (overdueTasks) independent of totalTasks", async () => {
    const admin = await createAdminUser();
    const overdueAsset = await createTestAsset({ serialNumber: "RPT-OVERDUE" });
    const busyAsset = await createTestAsset({ serialNumber: "RPT-BUSY" });

    // overdueAsset: 1 overdue task. busyAsset: 2 completed (not overdue) tasks.
    await createTestTask({
      assetId: overdueAsset.id,
      status: "OPEN",
      dueDate: new Date("2020-01-01T00:00:00.000Z"),
    });
    await createTestTask({ assetId: busyAsset.id, status: "DONE" });
    await createTestTask({ assetId: busyAsset.id, status: "DONE" });

    const byOverdue = await request(app)
      .get("/api/v1/reports/assets?sortBy=overdueTasks&sortOrder=desc")
      .set(authHeader(signTestAccessToken(admin)));
    expect(byOverdue.body.data[0].id).toBe(overdueAsset.id);

    const byTotal = await request(app)
      .get("/api/v1/reports/assets?sortBy=totalTasks&sortOrder=desc")
      .set(authHeader(signTestAccessToken(admin)));
    expect(byTotal.body.data[0].id).toBe(busyAsset.id);
  });

  it("should return 400 for an invalid sortBy", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/reports/assets?sortBy=nonsense")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(400);
  });
});

describe("GET /api/v1/reports/throughput", () => {
  const seedThroughputTasks = async () => {
    // Created + completed inside June
    await createTestTask({
      status: "DONE",
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      completedAt: new Date("2026-06-20T00:00:00.000Z"),
    });
    // Created inside June, still open
    await createTestTask({
      status: "OPEN",
      createdAt: new Date("2026-06-05T00:00:00.000Z"),
    });
    // Created BEFORE June, completed inside June
    await createTestTask({
      status: "DONE",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      completedAt: new Date("2026-06-25T00:00:00.000Z"),
    });
  };

  it("should summarise created vs completed within the range", async () => {
    const admin = await createAdminUser();
    await seedThroughputTasks();

    const response = await request(app)
      .get("/api/v1/reports/throughput?from=2026-06-01&to=2026-06-30&groupBy=month")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toMatchObject({
      totalCreated: 2, // the two created in June
      totalCompleted: 2, // the two completed in June
      completionRate: 1,
    });
    expect(response.body.data.summary.avgCompletionDays).toBeGreaterThan(0);
    expect(response.body.data.series).toHaveLength(1);
    expect(response.body.data.series[0]).toMatchObject({ created: 2, completed: 2 });
  });

  it("should zero-fill buckets with no activity", async () => {
    const admin = await createAdminUser();
    // Activity only in the first week of a three-week window.
    await createTestTask({ status: "OPEN", createdAt: new Date("2026-06-02T00:00:00.000Z") });

    const response = await request(app)
      .get("/api/v1/reports/throughput?from=2026-06-01&to=2026-06-21&groupBy=week")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.series.length).toBeGreaterThanOrEqual(3);
    expect(response.body.data.series.some((b: { created: number }) => b.created === 0)).toBe(true);
  });

  it("should default to the last 12 weeks when no range is given", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/reports/throughput")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.groupBy).toBe("week");
    expect(Array.isArray(response.body.data.series)).toBe(true);
  });

  it("should return null completionRate when nothing was created in range", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/reports/throughput?from=2026-06-01&to=2026-06-30&groupBy=month")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.summary.totalCreated).toBe(0);
    expect(response.body.data.summary.completionRate).toBeNull();
  });

  it("should return 400 when from is after to", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/reports/throughput?from=2026-08-01&to=2026-06-01")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(400);
  });

  it("should return 400 for an invalid groupBy", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/reports/throughput?groupBy=year")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(400);
  });

  it("should forbid a TECHNICIAN", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/reports/throughput")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(403);
  });
});
