import request from "supertest";

import app from "../../../src/app";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestInventoryItem,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/v1/inventory", () => {
  it("should return a paginated list for any authenticated role", async () => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem();

    const response = await request(app)
      .get("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  it("should filter to only low-stock items when lowStock=true", async () => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem({ name: "Low item", quantity: 1, minStockLevel: 5 });
    await createTestInventoryItem({ name: "Healthy item", quantity: 20, minStockLevel: 5 });

    const response = await request(app)
      .get("/api/v1/inventory?lowStock=true")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Low item");
  });

  it("should filter by search term across name and serial number", async () => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem({ name: "Cordless Drill", serialNumber: "SN-AAA" });
    await createTestInventoryItem({ name: "Angle Grinder", serialNumber: "SN-BBB" });

    const response = await request(app)
      .get("/api/v1/inventory?search=drill")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Cordless Drill");
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/inventory");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/inventory/:id", () => {
  it("should return the item when it exists", async () => {
    const technician = await createTechnicianUser();
    const item = await createTestInventoryItem();

    const response = await request(app)
      .get(`/api/v1/inventory/${item.id}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(item.id);
  });

  it("should return 404 when the item does not exist", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/inventory/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/inventory", () => {
  it("should create an item for ADMIN", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ name: "Cordless Drill", serialNumber: "SN-NEW-001", quantity: 10, minStockLevel: 2 });

    expect(response.status).toBe(201);
    expect(response.body.data.serialNumber).toBe("SN-NEW-001");
  });

  it("should create an item for MANAGER", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(manager)))
      .send({ name: "Cordless Drill", serialNumber: "SN-NEW-002", quantity: 10, minStockLevel: 2 });

    expect(response.status).toBe(201);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(technician)))
      .send({ name: "Cordless Drill", serialNumber: "SN-NEW-003", quantity: 10, minStockLevel: 2 });

    expect(response.status).toBe(403);
  });

  it("should return 409 when the serial number already exists", async () => {
    const admin = await createAdminUser();
    const existing = await createTestInventoryItem({ serialNumber: "SN-DUPLICATE" });

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ name: "Another Drill", serialNumber: existing.serialNumber, quantity: 5, minStockLevel: 1 });

    expect(response.status).toBe(409);
  });

  it("should return 400 for invalid input", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ name: "", serialNumber: "SN-BAD", quantity: -1, minStockLevel: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/v1/inventory/:id", () => {
  it("should update the item for ADMIN", async () => {
    const admin = await createAdminUser();
    const item = await createTestInventoryItem();

    const response = await request(app)
      .patch(`/api/v1/inventory/${item.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ quantity: 99 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(99);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();
    const item = await createTestInventoryItem();

    const response = await request(app)
      .patch(`/api/v1/inventory/${item.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ quantity: 99 });

    expect(response.status).toBe(403);
  });

  it("should return 404 when the item does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/inventory/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ quantity: 99 });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/v1/inventory/:id", () => {
  it("should delete the item for ADMIN", async () => {
    const admin = await createAdminUser();
    const item = await createTestInventoryItem();

    const response = await request(app)
      .delete(`/api/v1/inventory/${item.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
  });

  it("should return 403 for MANAGER", async () => {
    const manager = await createManagerUser();
    const item = await createTestInventoryItem();

    const response = await request(app)
      .delete(`/api/v1/inventory/${item.id}`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(403);
  });

  it("should return 404 when the item does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/inventory/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});
