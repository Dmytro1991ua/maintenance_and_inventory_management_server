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

    it("should snapshot the item's unit cost and expose a line total", async () => {
      const admin = await createAdminUser();
      const item = await createTestInventoryItem({
        quantity: 2,
        reorderQuantity: 10,
        unitCost: "8.50",
      });

      const response = await raise(signTestAccessToken(admin), item.id);

      expect(response.status).toBe(201);
      // 10 ordered × $8.50 = $85.00, both as fixed 2-decimal strings.
      expect(response.body.data.unitCostAtRaise).toBe("8.50");
      expect(response.body.data.lineTotal).toBe("85.00");
    });

    it("should leave cost null on the reorder when the item is unpriced", async () => {
      const admin = await createAdminUser();
      const item = await createTestInventoryItem({ quantity: 1, reorderQuantity: 5 });

      const response = await raise(signTestAccessToken(admin), item.id);

      expect(response.status).toBe(201);
      expect(response.body.data.unitCostAtRaise).toBeNull();
      expect(response.body.data.lineTotal).toBeNull();
    });

    it("should freeze the captured cost even if the item's price later changes", async () => {
      const admin = await createAdminUser();
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 4, unitCost: "10.00" });
      const created = await raise(signTestAccessToken(admin), item.id);

      // Change the item's price after the reorder was raised.
      await prisma.inventoryItem.update({ where: { id: item.id }, data: { unitCost: "99.00" } });

      const stored = await prisma.reorder.findUniqueOrThrow({ where: { id: created.body.data.id } });
      // Snapshot is unchanged: 4 × $10.00 committed, not the new $99.00.
      expect(stored.unitCostAtRaise?.toString()).toBe("10");
    });

    it("should expose the item's reorder point and supplier on the reorder row", async () => {
      const admin = await createAdminUser();
      const item = await createTestInventoryItem({
        quantity: 2,
        reorderPoint: 5,
        reorderQuantity: 10,
        supplier: "Acme Supplies",
      });

      const response = await raise(signTestAccessToken(admin), item.id);

      expect(response.status).toBe(201);
      expect(response.body.data.inventoryItem).toMatchObject({
        quantity: 2,
        minStockLevel: 5,
        reorderPoint: 5,
        supplier: "Acme Supplies",
      });
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

  describe("receiving with an actual cost", () => {
    const orderAndReceive = async (token: string, reorderId: string, body?: object) => {
      await request(app).patch(`/api/v1/reorders/${reorderId}/order`).set(authHeader(token));
      return request(app)
        .patch(`/api/v1/reorders/${reorderId}/receive`)
        .set(authHeader(token))
        .send(body ?? {});
    };

    it("should capture actual cost and expose received total + a positive variance", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10, unitCost: "8.50" });
      const created = await raise(token, item.id);

      const response = await orderAndReceive(token, created.body.data.id, {
        receivedUnitCost: "9.00",
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: "RECEIVED",
        unitCostAtRaise: "8.50",
        lineTotal: "85.00",
        receivedUnitCost: "9.00",
        receivedTotal: "90.00",
        variance: "5.00", // paid 90 vs committed 85 → +5 over
      });
      expect(response.body.data.receivedAt).not.toBeNull();
    });

    it("should expose a negative variance when the actual is below the estimate", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 4, unitCost: "10.00" });
      const created = await raise(token, item.id);

      const response = await orderAndReceive(token, created.body.data.id, {
        receivedUnitCost: "8.00",
      });

      // 4 × 8 = 32 paid vs 4 × 10 = 40 committed → −8 under.
      expect(response.body.data.receivedTotal).toBe("32.00");
      expect(response.body.data.variance).toBe("-8.00");
    });

    it("should leave actuals null when received without a cost", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10, unitCost: "8.50" });
      const created = await raise(token, item.id);

      const response = await orderAndReceive(token, created.body.data.id);

      expect(response.body.data.receivedUnitCost).toBeNull();
      expect(response.body.data.receivedTotal).toBeNull();
      expect(response.body.data.variance).toBeNull();
    });

    it("should record an actual even with no estimate, leaving variance null", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      // Item unpriced at raise → unitCostAtRaise null, so no estimate to compare.
      const item = await createTestInventoryItem({ quantity: 1, reorderQuantity: 5 });
      const created = await raise(token, item.id);

      const response = await orderAndReceive(token, created.body.data.id, {
        receivedUnitCost: "7.00",
      });

      expect(response.body.data.unitCostAtRaise).toBeNull();
      expect(response.body.data.receivedUnitCost).toBe("7.00");
      expect(response.body.data.receivedTotal).toBe("35.00");
      expect(response.body.data.variance).toBeNull();
    });

    it("should reject an invalid receivedUnitCost", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10, unitCost: "8.50" });
      const created = await raise(token, item.id);

      const response = await orderAndReceive(token, created.body.data.id, {
        receivedUnitCost: "9.999",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/reorders/stats", () => {
    it("should sum committed spend across open orders and count unpriced ones", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const priced = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10, unitCost: "8.50" });
      const unpriced = await createTestInventoryItem({ quantity: 1, reorderQuantity: 5 });
      await raise(token, priced.id); // 10 × 8.50 = 85.00, PENDING (open)
      await raise(token, unpriced.id); // no cost → counted as unpriced

      const response = await request(app)
        .get("/api/v1/reorders/stats")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        committedSpend: "85.00",
        openOrders: 2,
        unpricedOrders: 1,
      });
    });

    it("should move an order from committed to spent when received with a cost", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10, unitCost: "8.50" });
      const created = await raise(token, item.id);
      await request(app).patch(`/api/v1/reorders/${created.body.data.id}/order`).set(authHeader(token));
      await request(app)
        .patch(`/api/v1/reorders/${created.body.data.id}/receive`)
        .set(authHeader(token))
        .send({ receivedUnitCost: "9.00" });

      const response = await request(app)
        .get("/api/v1/reorders/stats")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      // No longer open → committed 0; received at 9.00 × 10 = 90 spent; variance
      // 90 − 85 = +5 over, across 1 comparable order.
      expect(response.body.data).toEqual({
        committedSpend: "0.00",
        openOrders: 0,
        unpricedOrders: 0,
        spent: "90.00",
        receivedOrders: 1,
        unrecordedReceived: 0,
        variance: "5.00",
        comparableOrders: 1,
      });
    });

    it("should count a received order with no recorded cost as unrecorded", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      const item = await createTestInventoryItem({ quantity: 2, reorderQuantity: 10, unitCost: "8.50" });
      const created = await raise(token, item.id);
      await request(app).patch(`/api/v1/reorders/${created.body.data.id}/order`).set(authHeader(token));
      // Receive without a cost — drops from committed, counts as unrecorded.
      await request(app).patch(`/api/v1/reorders/${created.body.data.id}/receive`).set(authHeader(token));

      const response = await request(app)
        .get("/api/v1/reorders/stats")
        .set(authHeader(token));

      expect(response.body.data).toMatchObject({
        committedSpend: "0.00",
        openOrders: 0,
        spent: "0.00",
        receivedOrders: 1,
        unrecordedReceived: 1,
        comparableOrders: 0,
      });
    });

    it("should forbid a TECHNICIAN", async () => {
      const tech = await createTechnicianUser();

      const response = await request(app)
        .get("/api/v1/reorders/stats")
        .set(authHeader(signTestAccessToken(tech)));

      expect(response.status).toBe(403);
    });
  });
});
