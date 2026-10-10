import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestAsset,
  createTestMeter,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

const createMeter = (token: string, body: object) =>
  request(app).post("/api/v1/meters").set(authHeader(token)).send(body);

const record = (token: string, meterId: string, body: object) =>
  request(app).post(`/api/v1/meters/${meterId}/readings`).set(authHeader(token)).send(body);

const storedMeter = (id: string) => prisma.meter.findUniqueOrThrow({ where: { id } });
const readingValues = async (meterId: string) =>
  (await prisma.meterReading.findMany({ where: { meterId } })).map((r) => r.value);

describe("POST /api/v1/meters", () => {
  it("should create a meter and log its initial reading as the first entry", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();

    const response = await createMeter(signTestAccessToken(manager), {
      assetId: asset.id,
      name: "Engine hours",
      unit: "hours",
      initialReading: 1240,
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      assetId: asset.id,
      name: "Engine hours",
      unit: "hours",
      currentReading: 1240,
    });
    expect(await readingValues(response.body.data.id)).toEqual([1240]);
  });

  it("should default the initial reading to 0 and still log it", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();

    const response = await createMeter(signTestAccessToken(manager), {
      assetId: asset.id,
      name: "Cycles",
      unit: "cycles",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.currentReading).toBe(0);
    expect(await readingValues(response.body.data.id)).toEqual([0]);
  });

  it("should reject a duplicate meter name on the same asset, ignoring surrounding spaces", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const asset = await createTestAsset();

    await createMeter(token, { assetId: asset.id, name: "Engine hours", unit: "hours" });
    const response = await createMeter(token, {
      assetId: asset.id,
      name: "  Engine hours ",
      unit: "hours",
    });

    expect(response.status).toBe(409);
  });

  it("should allow the same meter name on a different asset", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const assetA = await createTestAsset();
    const assetB = await createTestAsset();

    await createMeter(token, { assetId: assetA.id, name: "Engine hours", unit: "hours" });
    const response = await createMeter(token, {
      assetId: assetB.id,
      name: "Engine hours",
      unit: "hours",
    });

    expect(response.status).toBe(201);
  });

  it("should return 404 for an unknown asset", async () => {
    const manager = await createManagerUser();

    const response = await createMeter(signTestAccessToken(manager), {
      assetId: NONEXISTENT_ID,
      name: "Engine hours",
      unit: "hours",
    });

    expect(response.status).toBe(404);
  });

  it.each([
    ["a negative initial reading", { initialReading: -1 }],
    ["a fractional initial reading", { initialReading: 1.5 }],
    ["an initial reading above the integer ceiling", { initialReading: 2_147_483_648 }],
    ["a null initial reading", { initialReading: null }],
    ["a missing unit", { unit: undefined }],
    ["an unknown field", { color: "red" }],
  ])("should return 400 for %s", async (_label, override) => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();

    const response = await createMeter(signTestAccessToken(manager), {
      assetId: asset.id,
      name: "Engine hours",
      unit: "hours",
      ...override,
    });

    expect(response.status).toBe(400);
  });

  it("should forbid a TECHNICIAN and require authentication", async () => {
    const technician = await createTechnicianUser();
    const asset = await createTestAsset();
    const body = { assetId: asset.id, name: "Engine hours", unit: "hours" };

    expect((await createMeter(signTestAccessToken(technician), body)).status).toBe(403);
    expect((await request(app).post("/api/v1/meters").send(body)).status).toBe(401);
  });
});

describe("GET /api/v1/meters", () => {
  it("should list meters for any role, filterable by asset, with pagination meta", async () => {
    const technician = await createTechnicianUser();
    const assetA = await createTestAsset();
    const assetB = await createTestAsset();
    const onA = await createTestMeter({ assetId: assetA.id });
    await createTestMeter({ assetId: assetB.id });

    const response = await request(app)
      .get(`/api/v1/meters?assetId=${assetA.id}&limit=10`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(200);
    expect(response.body.data.map((m: { id: string }) => m.id)).toEqual([onA.id]);
    expect(response.body.meta).toMatchObject({ total: 1, page: 1, limit: 10, pages: 1 });
  });

  it("should return 401 without a token", async () => {
    expect((await request(app).get("/api/v1/meters")).status).toBe(401);
  });
});

describe("PATCH /api/v1/meters/:id", () => {
  it("should rename a meter, and allow resending its own name", async () => {
    const manager = await createManagerUser();
    const token = signTestAccessToken(manager);
    const meter = await createTestMeter({ name: "Engine hours" });

    const renamed = await request(app)
      .patch(`/api/v1/meters/${meter.id}`)
      .set(authHeader(token))
      .send({ name: "Main engine hours" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe("Main engine hours");

    const same = await request(app)
      .patch(`/api/v1/meters/${meter.id}`)
      .set(authHeader(token))
      .send({ name: "Main engine hours" });
    expect(same.status).toBe(200);
  });

  it("should reject renaming onto a sibling meter's name", async () => {
    const manager = await createManagerUser();
    const asset = await createTestAsset();
    await createTestMeter({ assetId: asset.id, name: "Odometer", unit: "km" });
    const hours = await createTestMeter({ assetId: asset.id, name: "Engine hours" });

    const response = await request(app)
      .patch(`/api/v1/meters/${hours.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ name: "Odometer" });

    expect(response.status).toBe(409);
  });

  it("should not allow changing the unit", async () => {
    const manager = await createManagerUser();
    const meter = await createTestMeter();

    const response = await request(app)
      .patch(`/api/v1/meters/${meter.id}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ name: "Engine hours", unit: "km" });

    expect(response.status).toBe(400);
    expect((await storedMeter(meter.id)).unit).toBe("hours");
  });

  it("should return 404 for an unknown meter and 403 for a TECHNICIAN", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();
    const meter = await createTestMeter();

    const missing = await request(app)
      .patch(`/api/v1/meters/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ name: "X" });
    const forbidden = await request(app)
      .patch(`/api/v1/meters/${meter.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ name: "X" });

    expect(missing.status).toBe(404);
    expect(forbidden.status).toBe(403);
  });
});

describe("DELETE /api/v1/meters/:id", () => {
  it("should delete the meter together with its reading history", async () => {
    const manager = await createManagerUser();
    const meter = await createTestMeter({ currentReading: 50 });
    await record(signTestAccessToken(manager), meter.id, { value: 60 });

    const response = await request(app)
      .delete(`/api/v1/meters/${meter.id}`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(204);
    expect(await prisma.meter.count({ where: { id: meter.id } })).toBe(0);
    expect(await prisma.meterReading.count({ where: { meterId: meter.id } })).toBe(0);
  });

  it("should return 404 for an unknown meter and 403 for a TECHNICIAN", async () => {
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();
    const meter = await createTestMeter();

    expect(
      (
        await request(app)
          .delete(`/api/v1/meters/${NONEXISTENT_ID}`)
          .set(authHeader(signTestAccessToken(manager)))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/v1/meters/${meter.id}`)
          .set(authHeader(signTestAccessToken(technician)))
      ).status,
    ).toBe(403);
  });

  it("should be removed along with its asset", async () => {
    const admin = await createAdminUser();
    const meter = await createTestMeter({ currentReading: 10 });

    const response = await request(app)
      .delete(`/api/v1/assets/${meter.assetId}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
    expect(await prisma.meter.count({ where: { id: meter.id } })).toBe(0);
    expect(await prisma.meterReading.count({ where: { meterId: meter.id } })).toBe(0);
  });
});

describe("POST /api/v1/meters/:id/readings", () => {
  it("should let a TECHNICIAN record a reading, stamped by the server", async () => {
    const technician = await createTechnicianUser();
    const meter = await createTestMeter({ currentReading: 100 });
    const before = Date.now();

    const response = await record(signTestAccessToken(technician), meter.id, { value: 130 });

    expect(response.status).toBe(201);
    expect(response.body.data.meter.currentReading).toBe(130);
    expect(response.body.data.reading).toMatchObject({
      meterId: meter.id,
      value: 130,
      recorder: { id: technician.id },
    });
    expect(new Date(response.body.data.reading.recordedAt).getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
    expect((await storedMeter(meter.id)).currentReading).toBe(130);
  });

  it("should accept an equal reading and log it", async () => {
    const technician = await createTechnicianUser();
    const meter = await createTestMeter({ currentReading: 100 });

    const response = await record(signTestAccessToken(technician), meter.id, { value: 100 });

    expect(response.status).toBe(201);
    expect(await readingValues(meter.id)).toEqual([100, 100]);
  });

  it("should reject a lower reading with 409 and leave the meter and log untouched", async () => {
    const technician = await createTechnicianUser();
    const meter = await createTestMeter({ currentReading: 100 });

    const response = await record(signTestAccessToken(technician), meter.id, { value: 99 });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain("(100)");
    expect((await storedMeter(meter.id)).currentReading).toBe(100);
    expect(await readingValues(meter.id)).toEqual([100]);
  });

  it("should return 404 for an unknown meter", async () => {
    const technician = await createTechnicianUser();

    const response = await record(signTestAccessToken(technician), NONEXISTENT_ID, { value: 5 });

    expect(response.status).toBe(404);
  });

  it.each([
    [
      "a client-supplied recordedAt (readings can't be back-dated)",
      { value: 150, recordedAt: "2020-01-01T00:00:00.000Z" },
    ],
    ["a string value", { value: "150" }],
    ["a null value", { value: null }],
    ["a missing value", {}],
    ["a negative value", { value: -1 }],
    ["a fractional value", { value: 150.5 }],
    ["a value above the integer ceiling", { value: 2_147_483_648 }],
  ])("should return 400 for %s", async (_label, body) => {
    const technician = await createTechnicianUser();
    const meter = await createTestMeter({ currentReading: 100 });

    const response = await record(signTestAccessToken(technician), meter.id, body);

    expect(response.status).toBe(400);
    expect((await storedMeter(meter.id)).currentReading).toBe(100);
  });

  it("should return 401 without a token", async () => {
    const meter = await createTestMeter();

    const response = await request(app)
      .post(`/api/v1/meters/${meter.id}/readings`)
      .send({ value: 5 });

    expect(response.status).toBe(401);
  });

  describe("concurrency", () => {
    it("should keep the meter and its log consistent when readings race", async () => {
      const technician = await createTechnicianUser();
      const token = signTestAccessToken(technician);
      const meter = await createTestMeter({ currentReading: 100 });
      const values = [150, 120, 140, 110, 160, 130];

      const responses = await Promise.all(
        values.map((value) => record(token, meter.id, { value })),
      );

      // Each is either accepted or rejected as too low — never an error.
      expect(responses.every((r) => r.status === 201 || r.status === 409)).toBe(true);

      const accepted = responses.filter((r) => r.status === 201).length;
      const logged = await readingValues(meter.id);

      // The highest value always wins, so the meter ends there and matches the log.
      expect((await storedMeter(meter.id)).currentReading).toBe(160);
      expect(Math.max(...logged)).toBe(160);
      // Exactly the accepted readings (plus the initial one) were logged.
      expect(logged).toHaveLength(accepted + 1);
    });

    // Deterministic: hold the meter's row lock in an outside transaction, fire a
    // reading that must wait on it, and require its timestamp to fall AFTER the lock
    // was released. A timestamp taken before waiting can't satisfy that, which is how
    // a waiter used to be stamped earlier than the reading it waited behind.
    it("should stamp a reading that waited on the row lock after the lock was released", async () => {
      const technician = await createTechnicianUser();
      const token = signTestAccessToken(technician);
      const meter = await createTestMeter({ currentReading: 100 });
      let lockHeld!: () => void;
      const lockAcquired = new Promise<void>((resolve) => (lockHeld = resolve));

      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM meters WHERE id = ${meter.id} FOR UPDATE`;
        lockHeld();
        await new Promise((resolve) => setTimeout(resolve, 400));
        const [{ released }] = await tx.$queryRaw<{ released: Date }[]>`
          SELECT (clock_timestamp() AT TIME ZONE 'UTC') AS released`;

        return released;
      });

      await lockAcquired;
      // supertest only sends on .then(), so chain now to dispatch while the lock is held.
      const waiting = record(token, meter.id, { value: 150 }).then((response) => response);
      await new Promise((resolve) => setTimeout(resolve, 150)); // let it block on the lock
      const released = await holder;
      const response = await waiting;

      expect(response.status).toBe(201);
      const recordedAt = new Date(response.body.data.reading.recordedAt).getTime();
      expect(recordedAt).toBeGreaterThanOrEqual(released.getTime());
      expect(new Date(response.body.data.meter.lastReadingAt).getTime()).toBe(recordedAt);
    });

    // Property check under real contention: history in time order never rises, and
    // its newest entry is the meter's current reading.
    it("should keep history in time order, ending at the current reading, when readings race", async () => {
      const technician = await createTechnicianUser();
      const token = signTestAccessToken(technician);
      const values = [112, 103, 109, 101, 111, 106, 110, 102, 108, 104, 107, 105];

      for (let trial = 0; trial < 3; trial++) {
        const meter = await createTestMeter({ name: `Trial ${trial}`, currentReading: 100 });

        await Promise.all(values.map((value) => record(token, meter.id, { value })));

        const history = await request(app)
          .get(`/api/v1/meters/${meter.id}/readings?limit=100`)
          .set(authHeader(token));
        const newestFirst: number[] = history.body.data.map((r: { value: number }) => r.value);

        expect(newestFirst[0]).toBe((await storedMeter(meter.id)).currentReading);
        expect(newestFirst).toEqual([...newestFirst].sort((a, b) => b - a));
      }
    });

    it("should accept two simultaneous equal readings", async () => {
      const technician = await createTechnicianUser();
      const token = signTestAccessToken(technician);
      const meter = await createTestMeter({ currentReading: 100 });

      const responses = await Promise.all([
        record(token, meter.id, { value: 200 }),
        record(token, meter.id, { value: 200 }),
      ]);

      expect(responses.map((r) => r.status)).toEqual([201, 201]);
      expect(await readingValues(meter.id)).toHaveLength(3);
      expect((await storedMeter(meter.id)).currentReading).toBe(200);
    });
  });
});

describe("GET /api/v1/meters/:id/readings", () => {
  it("should list history newest first with pagination meta", async () => {
    const technician = await createTechnicianUser();
    const token = signTestAccessToken(technician);
    const meter = await createTestMeter({ currentReading: 100 });
    for (const value of [110, 120, 130]) await record(token, meter.id, { value });

    const response = await request(app)
      .get(`/api/v1/meters/${meter.id}/readings?limit=3`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.map((r: { value: number }) => r.value)).toEqual([130, 120, 110]);
    expect(response.body.meta).toMatchObject({ total: 4, page: 1, limit: 3, pages: 2 });
  });

  it("should return 404 for an unknown meter and 401 without a token", async () => {
    const technician = await createTechnicianUser();

    expect(
      (
        await request(app)
          .get(`/api/v1/meters/${NONEXISTENT_ID}/readings`)
          .set(authHeader(signTestAccessToken(technician)))
      ).status,
    ).toBe(404);
    expect((await request(app).get(`/api/v1/meters/${NONEXISTENT_ID}/readings`)).status).toBe(401);
  });
});
