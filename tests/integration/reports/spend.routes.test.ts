import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import type { InventoryCategory } from "../../../src/generated/prisma/client";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestInventoryItem,
  signTestAccessToken,
} from "../helpers";

const getSpend = async (query = "from=2026-06-01&to=2026-07-31&groupBy=month") => {
  const admin = await createAdminUser();

  return request(app)
    .get(`/api/v1/reports/spend?${query}`)
    .set(authHeader(signTestAccessToken(admin)));
};

type ReceivedOrder = {
  itemId: string;
  quantity: number;
  receivedAt: Date;
  raised?: string | null; // unit cost when raised (the estimate)
  paid?: string | null; // actual unit cost recorded at receive
};

const received = ({ itemId, quantity, receivedAt, raised = null, paid = null }: ReceivedOrder) =>
  prisma.reorder.create({
    data: {
      inventoryItemId: itemId,
      quantity,
      status: "RECEIVED",
      unitCostAtRaise: raised,
      receivedUnitCost: paid,
      receivedAt,
    },
  });

const item = (supplier: string | null, category: InventoryCategory) =>
  createTestInventoryItem({ category, ...(supplier && { supplier }) });

describe("GET /api/v1/reports/spend", () => {
  // Two items: Acme/HVAC and no-supplier/TOOLS. June has three received orders,
  // July one; the rest must be left out.
  const seed = async () => {
    const acme = await item("Acme", "HVAC");
    const noSupplier = await item(null, "TOOLS");

    await received({
      itemId: acme.id,
      quantity: 10,
      receivedAt: new Date("2026-06-10T12:00:00.000Z"),
      raised: "8.00",
      paid: "9.00",
    }); // spent 90.00, +10.00 over estimate
    await received({
      itemId: acme.id,
      quantity: 5,
      receivedAt: new Date("2026-07-05T12:00:00.000Z"),
      paid: "10.00",
    }); // spent 50.00, no estimate
    await received({
      itemId: noSupplier.id,
      quantity: 2,
      receivedAt: new Date("2026-06-20T12:00:00.000Z"),
      raised: "5.00",
      paid: "4.00",
    }); // spent 8.00, -2.00 under estimate
    await received({
      itemId: noSupplier.id,
      quantity: 3,
      receivedAt: new Date("2026-06-21T12:00:00.000Z"),
      raised: "6.00",
    }); // received but no price recorded

    // Left out: received before the range, and orders that were never received.
    await received({
      itemId: acme.id,
      quantity: 1,
      receivedAt: new Date("2026-05-01T12:00:00.000Z"),
      paid: "100.00",
    });
    await prisma.reorder.create({
      data: { inventoryItemId: acme.id, quantity: 9, status: "PENDING", unitCostAtRaise: "7.00" },
    });
    await prisma.reorder.create({
      data: {
        inventoryItemId: acme.id,
        quantity: 9,
        status: "CANCELLED",
        unitCostAtRaise: "7.00",
      },
    });
  };

  it("should total what was paid, and report the unpriced and the variance separately", async () => {
    await seed();

    const response = await getSpend();

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      spent: "148.00",
      receivedOrders: 4,
      unrecordedReceived: 1,
      variance: "8.00", // +10.00 and -2.00; the other orders lack one of the two prices
      comparableOrders: 2,
    });
  });

  it("should bucket the spend by month", async () => {
    await seed();

    const response = await getSpend();

    expect(response.body.data.series).toEqual([
      { bucket: "2026-06-01T00:00:00.000Z", spent: "98.00", receivedOrders: 3 },
      { bucket: "2026-07-01T00:00:00.000Z", spent: "50.00", receivedOrders: 1 },
    ]);
  });

  it("should break the spend down by supplier, biggest first, with no supplier as null", async () => {
    await seed();

    const response = await getSpend();

    expect(response.body.data.bySupplier).toEqual([
      { supplier: "Acme", spent: "140.00", receivedOrders: 2 },
      { supplier: null, spent: "8.00", receivedOrders: 2 },
    ]);
  });

  it("should break the spend down by category, biggest first", async () => {
    await seed();

    const response = await getSpend();

    expect(response.body.data.byCategory).toEqual([
      { category: "HVAC", spent: "140.00", receivedOrders: 2 },
      { category: "TOOLS", spent: "8.00", receivedOrders: 2 },
    ]);
  });

  it("should fill empty buckets with zero", async () => {
    await seed();

    const response = await getSpend("from=2026-06-01&to=2026-08-31&groupBy=month");

    expect(response.body.data.series).toEqual([
      { bucket: "2026-06-01T00:00:00.000Z", spent: "98.00", receivedOrders: 3 },
      { bucket: "2026-07-01T00:00:00.000Z", spent: "50.00", receivedOrders: 1 },
      { bucket: "2026-08-01T00:00:00.000Z", spent: "0.00", receivedOrders: 0 },
    ]);
  });

  it("should support weekly buckets", async () => {
    await seed();

    const response = await getSpend("from=2026-06-08&to=2026-06-28&groupBy=week");

    // Weeks start on Monday: 8th, 15th, 22nd. The 10th falls in the first, the
    // 20th and 21st (a Saturday and Sunday) in the second.
    expect(response.body.data.series).toEqual([
      { bucket: "2026-06-08T00:00:00.000Z", spent: "90.00", receivedOrders: 1 },
      { bucket: "2026-06-15T00:00:00.000Z", spent: "8.00", receivedOrders: 2 },
      { bucket: "2026-06-22T00:00:00.000Z", spent: "0.00", receivedOrders: 0 },
    ]);
  });

  it("should return zeros and empty breakdowns when nothing was received", async () => {
    const response = await getSpend();

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      spent: "0.00",
      receivedOrders: 0,
      unrecordedReceived: 0,
      variance: "0.00",
      comparableOrders: 0,
    });
    expect(response.body.data.bySupplier).toEqual([]);
    expect(response.body.data.byCategory).toEqual([]);
    expect(response.body.data.series).toHaveLength(2);
  });

  it("should add up money exactly, with no floating-point drift", async () => {
    const part = await item("Acme", "HVAC");
    await received({
      itemId: part.id,
      quantity: 3,
      receivedAt: new Date("2026-06-10T12:00:00.000Z"),
      paid: "0.10",
    });

    const response = await getSpend();

    expect(response.body.data.summary.spent).toBe("0.30");
  });

  it("should default to the last 12 months, bucketed by month", async () => {
    const part = await item("Acme", "HVAC");
    await received({
      itemId: part.id,
      quantity: 1,
      receivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      paid: "12.00",
    });
    await received({
      itemId: part.id,
      quantity: 1,
      receivedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      paid: "99.00",
    });

    const response = await getSpend("");

    expect(response.status).toBe(200);
    expect(response.body.data.groupBy).toBe("month");
    expect(response.body.data.summary.spent).toBe("12.00");
  });

  it("should not fail on large quantities and prices", async () => {
    const part = await item("Acme", "HVAC");
    await received({
      itemId: part.id,
      quantity: 2_000_000_000,
      receivedAt: new Date("2026-06-10T12:00:00.000Z"),
      paid: "99999.99",
    });

    const response = await getSpend();

    expect(response.status).toBe(200);
    expect(response.body.data.summary.spent).toBe("199999980000000.00");
  });

  it("should return 400 when from is after to", async () => {
    const response = await getSpend("from=2026-08-01&to=2026-06-01");

    expect(response.status).toBe(400);
  });

  it("should return 400 for an unknown groupBy", async () => {
    const response = await getSpend("groupBy=year");

    expect(response.status).toBe(400);
  });
});

describe("GET /api/v1/reports/spend — access", () => {
  it("should allow a manager", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .get("/api/v1/reports/spend")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
  });

  it("should return 403 for a technician", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/reports/spend")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 401 without a token", async () => {
    const response = await request(app).get("/api/v1/reports/spend");

    expect(response.status).toBe(401);
  });
});
