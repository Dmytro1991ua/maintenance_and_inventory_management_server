import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createManagerUser,
  createTechnicianUser,
  createTestAsset,
  signTestAccessToken,
} from "../helpers";

const SENT_AT = new Date("2026-10-01T08:00:00.000Z");

const patchAsset = (token: string, id: string, body: object) =>
  request(app).patch(`/api/v1/assets/${id}`).set(authHeader(token)).send(body);

const storedSentAt = async (id: string) =>
  (await prisma.asset.findUniqueOrThrow({ where: { id } })).warrantyReminderSentAt;

describe("asset warranty", () => {
  describe("create and read", () => {
    it("should store the warranty as a calendar date and return it as midnight UTC", async () => {
      const manager = await createManagerUser();

      const response = await request(app)
        .post("/api/v1/assets")
        .set(authHeader(signTestAccessToken(manager)))
        .send({
          name: "Boiler",
          serialNumber: "WARR-001",
          category: "HVAC",
          location: "Basement",
          warrantyExpiresAt: "2027-06-15",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.warrantyExpiresAt).toBe("2027-06-15T00:00:00.000Z");
    });

    it("should drop any time-of-day sent with the date", async () => {
      const manager = await createManagerUser();

      const response = await request(app)
        .post("/api/v1/assets")
        .set(authHeader(signTestAccessToken(manager)))
        .send({
          name: "Chiller",
          serialNumber: "WARR-002",
          category: "HVAC",
          location: "Roof",
          warrantyExpiresAt: "2027-06-15T18:30:00.000Z",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.warrantyExpiresAt).toBe("2027-06-15T00:00:00.000Z");
    });

    it("should store null, not 1970, when a form sends null dates on create", async () => {
      const manager = await createManagerUser();

      const response = await request(app)
        .post("/api/v1/assets")
        .set(authHeader(signTestAccessToken(manager)))
        .send({
          name: "Pump",
          serialNumber: "WARR-003",
          category: "PLUMBING",
          location: "Basement",
          installDate: null,
          warrantyExpiresAt: null,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.warrantyExpiresAt).toBeNull();
      expect(response.body.data.installDate).toBeNull();
    });

    it("should return null warrantyExpiresAt for an asset with no warranty", async () => {
      const technician = await createTechnicianUser();
      const asset = await createTestAsset();

      const response = await request(app)
        .get(`/api/v1/assets/${asset.id}`)
        .set(authHeader(signTestAccessToken(technician)));

      expect(response.status).toBe(200);
      expect(response.body.data.warrantyExpiresAt).toBeNull();
    });

    it("should not expose the internal reminder marker", async () => {
      const technician = await createTechnicianUser();
      const asset = await createTestAsset({
        warrantyExpiresAt: new Date("2027-06-15T00:00:00.000Z"),
        warrantyReminderSentAt: SENT_AT,
      });

      const response = await request(app)
        .get(`/api/v1/assets/${asset.id}`)
        .set(authHeader(signTestAccessToken(technician)));

      expect(response.body.data).not.toHaveProperty("warrantyReminderSentAt");
    });
  });

  describe("update and re-arming the reminder", () => {
    it("should set and clear the warranty date", async () => {
      const manager = await createManagerUser();
      const token = signTestAccessToken(manager);
      const asset = await createTestAsset();

      const set = await patchAsset(token, asset.id, { warrantyExpiresAt: "2027-01-31" });
      expect(set.status).toBe(200);
      expect(set.body.data.warrantyExpiresAt).toBe("2027-01-31T00:00:00.000Z");

      const cleared = await patchAsset(token, asset.id, { warrantyExpiresAt: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.warrantyExpiresAt).toBeNull();
    });

    it("should re-arm the reminder when the warranty date changes", async () => {
      const manager = await createManagerUser();
      const asset = await createTestAsset({
        warrantyExpiresAt: new Date("2026-11-14T00:00:00.000Z"),
        warrantyReminderSentAt: SENT_AT,
      });

      // Warranty extended: a fresh reminder should be possible.
      await patchAsset(signTestAccessToken(manager), asset.id, { warrantyExpiresAt: "2027-02-14" });

      expect(await storedSentAt(asset.id)).toBeNull();
    });

    it("should NOT re-arm when the same date is resent", async () => {
      const manager = await createManagerUser();
      const asset = await createTestAsset({
        warrantyExpiresAt: new Date("2026-11-14T00:00:00.000Z"),
        warrantyReminderSentAt: SENT_AT,
      });

      // A form resending every field includes the unchanged date.
      await patchAsset(signTestAccessToken(manager), asset.id, {
        warrantyExpiresAt: "2026-11-14",
      });

      expect(await storedSentAt(asset.id)).toEqual(SENT_AT);
    });

    it("should NOT re-arm when the same day is resent with a different time of day", async () => {
      const manager = await createManagerUser();
      const asset = await createTestAsset({
        warrantyExpiresAt: new Date("2026-11-14T00:00:00.000Z"),
        warrantyReminderSentAt: SENT_AT,
      });

      await patchAsset(signTestAccessToken(manager), asset.id, {
        warrantyExpiresAt: "2026-11-14T10:00:00.000Z",
      });

      expect(await storedSentAt(asset.id)).toEqual(SENT_AT);
    });

    it("should NOT re-arm on an unrelated edit like a rename", async () => {
      const manager = await createManagerUser();
      const asset = await createTestAsset({
        warrantyExpiresAt: new Date("2026-11-14T00:00:00.000Z"),
        warrantyReminderSentAt: SENT_AT,
      });

      const response = await patchAsset(signTestAccessToken(manager), asset.id, {
        name: "Renamed Boiler",
      });

      expect(response.status).toBe(200);
      expect(await storedSentAt(asset.id)).toEqual(SENT_AT);
    });

    it("should re-arm when the warranty is cleared and later set again", async () => {
      const manager = await createManagerUser();
      const token = signTestAccessToken(manager);
      const asset = await createTestAsset({
        warrantyExpiresAt: new Date("2026-11-14T00:00:00.000Z"),
        warrantyReminderSentAt: SENT_AT,
      });

      await patchAsset(token, asset.id, { warrantyExpiresAt: null });
      expect(await storedSentAt(asset.id)).toBeNull();

      // Same date as before, but cleared in between: no marker carries over.
      await patchAsset(token, asset.id, { warrantyExpiresAt: "2026-11-14" });
      expect(await storedSentAt(asset.id)).toBeNull();
    });
  });
});
