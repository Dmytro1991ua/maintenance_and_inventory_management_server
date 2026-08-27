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

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/v1/assets/categories", () => {
  it("should return the list of valid asset categories", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/assets/categories")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining(["HVAC", "ELECTRICAL", "PLUMBING", "VEHICLE"]),
    );
  });

  it("should return 401 without a token", async () => {
    const response = await request(app).get("/api/v1/assets/categories");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/assets/stats", () => {
  it("should aggregate counts by status and by category", async () => {
    const user = await createTechnicianUser();

    await createTestAsset({ category: "HVAC", status: "OPERATIONAL" });
    await createTestAsset({ category: "HVAC", status: "DOWN" });
    await createTestAsset({ category: "VEHICLE", status: "RETIRED" });

    const response = await request(app)
      .get("/api/v1/assets/stats")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      total: 3,
      operational: 1,
      down: 1,
      retired: 1,
    });
    expect(response.body.data.byCategory.HVAC).toMatchObject({
      total: 2,
      operational: 1,
      down: 1,
    });
  });
});

describe("GET /api/v1/assets", () => {
  it("should list assets with pagination meta", async () => {
    const user = await createTechnicianUser();
    await createTestAsset();
    await createTestAsset();

    const response = await request(app)
      .get("/api/v1/assets")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toMatchObject({ total: 2, page: 1, limit: 20 });
  });

  it("should filter by category", async () => {
    const user = await createTechnicianUser();
    await createTestAsset({ category: "HVAC" });
    await createTestAsset({ category: "VEHICLE" });

    const response = await request(app)
      .get("/api/v1/assets?category=VEHICLE")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].category).toBe("VEHICLE");
  });

  it("should filter by status", async () => {
    const user = await createTechnicianUser();
    await createTestAsset({ status: "OPERATIONAL" });
    await createTestAsset({ status: "DOWN" });

    const response = await request(app)
      .get("/api/v1/assets?status=DOWN")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe("DOWN");
  });

  it("should search by name, serial, or location", async () => {
    const user = await createTechnicianUser();
    await createTestAsset({ name: "Forklift — Warehouse", serialNumber: "VEH-FRK-100" });
    await createTestAsset({ name: "Boiler", serialNumber: "HVAC-BLR-100" });

    const response = await request(app)
      .get("/api/v1/assets?search=forklift")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].serialNumber).toBe("VEH-FRK-100");
  });

  it("should return 400 for an invalid status filter", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/assets?status=BROKEN")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(400);
  });
});

describe("GET /api/v1/assets/:id", () => {
  it("should return a single asset", async () => {
    const user = await createTechnicianUser();
    const asset = await createTestAsset({ manufacturer: "Carrier", model: "48TCED12" });

    const response = await request(app)
      .get(`/api/v1/assets/${asset.id}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: asset.id,
      serialNumber: asset.serialNumber,
      manufacturer: "Carrier",
      model: "48TCED12",
    });
  });

  it("should return 404 for an unknown asset", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/assets/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(404);
  });
});

describe("GET /api/v1/assets/:id/tasks", () => {
  it("should return only the tasks recorded against the asset", async () => {
    const user = await createTechnicianUser();
    const asset = await createTestAsset();
    const otherAsset = await createTestAsset();

    await createTestTask({ title: "On asset", assetId: asset.id });
    await createTestTask({ title: "On other asset", assetId: otherAsset.id });
    await createTestTask({ title: "No asset" });

    const response = await request(app)
      .get(`/api/v1/assets/${asset.id}/tasks`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("On asset");
    expect(response.body.data[0].asset).toMatchObject({ id: asset.id });
  });

  it("should return an empty page for an asset with no tasks", async () => {
    const user = await createTechnicianUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .get(`/api/v1/assets/${asset.id}/tasks`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it("should return 404 when the asset does not exist", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/assets/${NONEXISTENT_ID}/tasks`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/assets", () => {
  it("should let an ADMIN create an asset", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/assets")
      .set(authHeader(signTestAccessToken(admin)))
      .send({
        name: "Rooftop HVAC Unit #9",
        serialNumber: "HVAC-RTU-009",
        category: "HVAC",
        location: "Building C — Roof",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      serialNumber: "HVAC-RTU-009",
      status: "OPERATIONAL",
    });

    const stored = await prisma.asset.findUnique({ where: { serialNumber: "HVAC-RTU-009" } });
    expect(stored).not.toBeNull();
  });

  it("should let a MANAGER create an asset", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .post("/api/v1/assets")
      .set(authHeader(signTestAccessToken(manager)))
      .send({
        name: "Sump Pump",
        serialNumber: "PUMP-SMP-900",
        category: "PLUMBING",
        location: "Basement",
      });

    expect(response.status).toBe(201);
  });

  it("should forbid a TECHNICIAN from creating an asset", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/assets")
      .set(authHeader(signTestAccessToken(tech)))
      .send({
        name: "Sump Pump",
        serialNumber: "PUMP-SMP-901",
        category: "PLUMBING",
        location: "Basement",
      });

    expect(response.status).toBe(403);
  });

  it("should reject a duplicate serial number with 409", async () => {
    const admin = await createAdminUser();
    await createTestAsset({ serialNumber: "DUP-001" });

    const response = await request(app)
      .post("/api/v1/assets")
      .set(authHeader(signTestAccessToken(admin)))
      .send({
        name: "Another",
        serialNumber: "DUP-001",
        category: "HVAC",
        location: "Roof",
      });

    expect(response.status).toBe(409);
  });

  it("should return 400 when required fields are missing", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/assets")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ name: "No category or location" });

    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/v1/assets/:id", () => {
  it("should update an asset's status", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset({ status: "OPERATIONAL" });

    const response = await request(app)
      .patch(`/api/v1/assets/${asset.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "DOWN" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("DOWN");
  });

  it("should reject an attempt to change the serial number", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .patch(`/api/v1/assets/${asset.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ serialNumber: "CHANGED-001" });

    // UpdateAssetSchema is .strict() — serialNumber is not an allowed key
    expect(response.status).toBe(400);
  });

  it("should forbid a TECHNICIAN from updating an asset", async () => {
    const tech = await createTechnicianUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .patch(`/api/v1/assets/${asset.id}`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ status: "DOWN" });

    expect(response.status).toBe(403);
  });

  it("should return 404 for an unknown asset", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/assets/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "DOWN" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/v1/assets/:id", () => {
  it("should let an ADMIN delete an asset", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .delete(`/api/v1/assets/${asset.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
    expect(await prisma.asset.findUnique({ where: { id: asset.id } })).toBeNull();
  });

  it("should preserve tasks but null their assetId when the asset is deleted", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();
    const task = await createTestTask({ assetId: asset.id });

    const response = await request(app)
      .delete(`/api/v1/assets/${asset.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);

    const survivingTask = await prisma.task.findUnique({ where: { id: task.id } });
    expect(survivingTask).not.toBeNull();
    expect(survivingTask?.assetId).toBeNull();
  });

  it("should forbid a MANAGER from deleting an asset", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .delete(`/api/v1/assets/${asset.id}`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(403);
    expect(await prisma.asset.findUnique({ where: { id: asset.id } })).not.toBeNull();
  });

  it("should return 404 for an unknown asset", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/assets/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});

describe("Task ↔ Asset link", () => {
  it("should attach an asset when creating a task and echo it back", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Service the unit", assetId: asset.id });

    expect(response.status).toBe(201);
    expect(response.body.data.assetId).toBe(asset.id);
    expect(response.body.data.asset).toMatchObject({
      id: asset.id,
      serialNumber: asset.serialNumber,
    });
  });

  it("should 404 when creating a task with a nonexistent assetId", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/tasks")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ title: "Orphan link", assetId: NONEXISTENT_ID });

    expect(response.status).toBe(404);
  });

  it("should link an asset when updating a task", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();
    const task = await createTestTask();

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assetId: asset.id });

    expect(response.status).toBe(200);
    expect(response.body.data.assetId).toBe(asset.id);
    expect(response.body.data.asset).toMatchObject({ id: asset.id });
  });

  it("should unlink an asset when updating a task with assetId: null", async () => {
    const admin = await createAdminUser();
    const asset = await createTestAsset();
    const task = await createTestTask({ assetId: asset.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assetId: null });

    expect(response.status).toBe(200);
    expect(response.body.data.assetId).toBeNull();
    expect(response.body.data.asset).toBeNull();
  });

  it("should 404 when updating a task with a nonexistent assetId", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ assetId: NONEXISTENT_ID });

    expect(response.status).toBe(404);
  });

  it("should forbid a TECHNICIAN from setting a task's assetId", async () => {
    const tech = await createTechnicianUser();
    const asset = await createTestAsset();
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ assetId: asset.id });

    // Technicians may only update status — anything else is 403
    expect(response.status).toBe(403);
  });
});
