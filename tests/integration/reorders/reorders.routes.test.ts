import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createTechnicianUser,
  createTestInventoryItem,
  signTestAccessToken,
} from "../helpers";

const raise = (token: string, inventoryItemId: string) =>
  request(app).post("/api/v1/reorders").set(authHeader(token)).send({ inventoryItemId });

describe("Reorders routes", () => {
  describe("POST /api/v1/reorders", () => {
    it("should raise a PENDING reorder for an item, ordering its reorderQuantity", async () => {
      const admin = await createAdminUser();
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10 });

      const response = await raise(signTestAccessToken(admin), item.id);

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        inventoryItemId: item.id,
        status: "PENDING",
        quantity: 10,
        raisedBy: admin.id,
      });
    });

    it("should fall back to minStockLevel when the item has no reorderQuantity", async () => {
      const admin = await createAdminUser();
      const item = await createTestInventoryItem({ quantity: 1, minStockLevel: 7 });

      const response = await raise(signTestAccessToken(admin), item.id);

      expect(response.status).toBe(201);
      expect(response.body.data.quantity).toBe(7);
    });

    it("should reject a second open reorder for the same item with 409", async () => {
      const admin = await createAdminUser();
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10 });
      const token = signTestAccessToken(admin);

      const first = await raise(token, item.id);
      expect(first.status).toBe(201);

      const second = await raise(token, item.id);
      expect(second.status).toBe(409);
    });

    it("should return 404 for an unknown inventory item", async () => {
      const admin = await createAdminUser();

      const response = await raise(
        signTestAccessToken(admin),
        "00000000-0000-0000-0000-000000000000",
      );

      expect(response.status).toBe(404);
    });

    it("should forbid a TECHNICIAN", async () => {
      const tech = await createTechnicianUser();
      const item = await createTestInventoryItem();

      const response = await raise(signTestAccessToken(tech), item.id);

      expect(response.status).toBe(403);
    });

    it("should return 401 without a token", async () => {
      const item = await createTestInventoryItem();

      const response = await request(app)
        .post("/api/v1/reorders")
        .send({ inventoryItemId: item.id });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/reorders", () => {
    it("should list reorders with pagination meta and filter by status", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const itemA = await createTestInventoryItem({ quantity: 1, reorderQuantity: 5 });
      const itemB = await createTestInventoryItem({ quantity: 1, reorderQuantity: 5 });

      const a = await raise(token, itemA.id); // stays PENDING
      const b = await raise(token, itemB.id);
      // Move B to ORDERED so the PENDING filter excludes it.
      await request(app).patch(`/api/v1/reorders/${b.body.data.id}/order`).set(authHeader(token));

      const response = await request(app)
        .get("/api/v1/reorders?status=PENDING&limit=10")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      const ids = response.body.data.map((r: { id: string }) => r.id);
      expect(ids).toContain(a.body.data.id);
      expect(ids).not.toContain(b.body.data.id);
      expect(response.body.data.every((r: { status: string }) => r.status === "PENDING")).toBe(
        true,
      );
      expect(response.body.meta).toMatchObject({ page: 1, limit: 10 });
    });
  });

  describe("lifecycle transitions", () => {
    it("should mark a PENDING reorder ORDERED", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 1, reorderQuantity: 5 });
      const created = await raise(token, item.id);

      const response = await request(app)
        .patch(`/api/v1/reorders/${created.body.data.id}/order`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("ORDERED");
      expect(response.body.data.reviewedBy).toBe(admin.id);
    });

    it("should receive an ORDERED reorder and increment the item's stock", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10 });
      const created = await raise(token, item.id);
      await request(app)
        .patch(`/api/v1/reorders/${created.body.data.id}/order`)
        .set(authHeader(token));

      const response = await request(app)
        .patch(`/api/v1/reorders/${created.body.data.id}/receive`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("RECEIVED");
      expect(response.body.data.inventoryItem.quantity).toBe(12);

      const stored = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
      expect(stored?.quantity).toBe(12);
    });

    it("should reject receiving a reorder that has not been ordered with 409", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10 });
      const created = await raise(token, item.id);

      const response = await request(app)
        .patch(`/api/v1/reorders/${created.body.data.id}/receive`)
        .set(authHeader(token));

      expect(response.status).toBe(409);
      // Stock untouched.
      const stored = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
      expect(stored?.quantity).toBe(2);
    });

    it("should cancel an open reorder and reopen the loop so a new one can be raised", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 1, reorderQuantity: 5 });
      const created = await raise(token, item.id);

      const cancel = await request(app)
        .patch(`/api/v1/reorders/${created.body.data.id}/cancel`)
        .set(authHeader(token));
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe("CANCELLED");

      // The partial unique index only covers open statuses, so a fresh raise
      // is allowed again after cancelling.
      const again = await raise(token, item.id);
      expect(again.status).toBe(201);
    });

    it("should return 404 when ordering an unknown reorder", async () => {
      const admin = await createAdminUser();

      const response = await request(app)
        .patch("/api/v1/reorders/00000000-0000-0000-0000-000000000000/order")
        .set(authHeader(signTestAccessToken(admin)));

      expect(response.status).toBe(404);
    });
  });
});
