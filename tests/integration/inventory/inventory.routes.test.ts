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

  it("should filter to only low-stock items when status=LOW_STOCK", async () => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem({ name: "Low item", quantity: 1, minStockLevel: 5 });
    await createTestInventoryItem({ name: "Healthy item", quantity: 20, minStockLevel: 5 });

    const response = await request(app)
      .get("/api/v1/inventory?status=LOW_STOCK")
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

describe("GET /api/v1/inventory/stats", () => {
  it("should return aggregate counts across all categories", async () => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem({ quantity: 10, minStockLevel: 5 }); // inStock
    await createTestInventoryItem({ quantity: 2, minStockLevel: 5 });  // lowStock
    await createTestInventoryItem({ quantity: 0, minStockLevel: 5 });  // outOfStock

    const response = await request(app)
      .get("/api/v1/inventory/stats")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(3);
    expect(response.body.data.inStock).toBe(1);
    expect(response.body.data.lowStock).toBe(1);
    expect(response.body.data.outOfStock).toBe(1);
  });

  it("should return counts broken down byCategory", async () => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem({ category: "ELECTRICAL", quantity: 10, minStockLevel: 5 });
    await createTestInventoryItem({ category: "ELECTRICAL", quantity: 0, minStockLevel: 5 });
    await createTestInventoryItem({ category: "PLUMBING", quantity: 5, minStockLevel: 5 });

    const response = await request(app)
      .get("/api/v1/inventory/stats")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data.byCategory.ELECTRICAL.total).toBe(2);
    expect(response.body.data.byCategory.ELECTRICAL.outOfStock).toBe(1);
    expect(response.body.data.byCategory.PLUMBING.total).toBe(1);
    expect(response.body.data.byCategory.PLUMBING.inStock).toBe(1);
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/inventory/stats");

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
      .send({ name: "Cordless Drill", serialNumber: "SN-NEW-001", category: "TOOLS", quantity: 10, minStockLevel: 2 });

    expect(response.status).toBe(201);
    expect(response.body.data.serialNumber).toBe("SN-NEW-001");
    expect(response.body.data.category).toBe("TOOLS");
  });

  it("should create an item for MANAGER", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(manager)))
      .send({ name: "Cordless Drill", serialNumber: "SN-NEW-002", category: "TOOLS", quantity: 10, minStockLevel: 2 });

    expect(response.status).toBe(201);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(technician)))
      .send({ name: "Cordless Drill", serialNumber: "SN-NEW-003", category: "TOOLS", quantity: 10, minStockLevel: 2 });

    expect(response.status).toBe(403);
  });

  it("should return 409 when the serial number already exists", async () => {
    const admin = await createAdminUser();
    const existing = await createTestInventoryItem({ serialNumber: "SN-DUPLICATE" });

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ name: "Another Drill", serialNumber: existing.serialNumber, category: "TOOLS", quantity: 5, minStockLevel: 1 });

    expect(response.status).toBe(409);
  });

  it("should return 400 for invalid input", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ name: "", serialNumber: "SN-BAD", category: "TOOLS", quantity: -1, minStockLevel: 1 });

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

describe("PATCH /api/v1/inventory/:id/restock", () => {
  it("should increment quantity by quantityToAdd for ADMIN", async () => {
    const admin = await createAdminUser();
    const item = await createTestInventoryItem({ quantity: 5 });

    const response = await request(app)
      .patch(`/api/v1/inventory/${item.id}/restock`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ quantityToAdd: 10 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(15);
  });

  it("should increment quantity by quantityToAdd for MANAGER", async () => {
    const manager = await createManagerUser();
    const item = await createTestInventoryItem({ quantity: 0 });

    const response = await request(app)
      .patch(`/api/v1/inventory/${item.id}/restock`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ quantityToAdd: 25 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(25);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();
    const item = await createTestInventoryItem();

    const response = await request(app)
      .patch(`/api/v1/inventory/${item.id}/restock`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ quantityToAdd: 10 });

    expect(response.status).toBe(403);
  });

  it("should return 404 when the item does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/inventory/${NONEXISTENT_ID}/restock`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ quantityToAdd: 10 });

    expect(response.status).toBe(404);
  });

  it("should return 400 when quantityToAdd is less than 1", async () => {
    const admin = await createAdminUser();
    const item = await createTestInventoryItem();

    const response = await request(app)
      .patch(`/api/v1/inventory/${item.id}/restock`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ quantityToAdd: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
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

describe("GET /api/v1/inventory/categories", () => {
  it("should return all category values for any authenticated user", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/inventory/categories")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([
      "ELECTRICAL",
      "PLUMBING",
      "HVAC",
      "TOOLS",
      "FASTENERS",
      "CHEMICALS",
      "SAFETY",
      "BUILDING_MATERIALS",
    ]);
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/inventory/categories");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/inventory?category=", () => {
  it("should filter items by category", async () => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem({ name: "Wire Reel", category: "ELECTRICAL" });
    await createTestInventoryItem({ name: "Ball Valve", category: "PLUMBING" });

    const response = await request(app)
      .get("/api/v1/inventory?category=ELECTRICAL")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Wire Reel");
    expect(response.body.data[0].category).toBe("ELECTRICAL");
  });
});

describe("GET /api/v1/inventory?status=", () => {
  it.each([
    { status: "OUT_OF_STOCK", expectedName: "Empty item" },
    { status: "LOW_STOCK", expectedName: "Low item" },
    { status: "IN_STOCK", expectedName: "Healthy item" },
  ])("should return only $status items when status=$status", async ({ status, expectedName }) => {
    const technician = await createTechnicianUser();
    await createTestInventoryItem({ name: "Empty item", quantity: 0, minStockLevel: 5 });
    await createTestInventoryItem({ name: "Low item", quantity: 2, minStockLevel: 5 });
    await createTestInventoryItem({ name: "Healthy item", quantity: 20, minStockLevel: 5 });

    const response = await request(app)
      .get(`/api/v1/inventory?status=${status}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe(expectedName);
  });

  it("should return 400 for an invalid status value", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/inventory?status=INVALID")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
