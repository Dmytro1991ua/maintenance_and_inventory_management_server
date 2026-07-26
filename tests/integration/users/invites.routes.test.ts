import request from "supertest";

import app from "../../../src/app";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestUser,
  signTestAccessToken,
} from "../helpers";
import { createTestInvite } from "../helpers/invite.helpers";

// Never call Resend in integration tests — isolate the HTTP/DB layer only
jest.mock("../../../src/shared/email.service", () => ({
  emailService: { sendInvite: jest.fn().mockResolvedValue(undefined) },
}));

import { emailService } from "../../../src/shared/email.service";
const sendInviteMock = emailService.sendInvite as jest.MockedFunction<typeof emailService.sendInvite>;

describe("POST /api/v1/users/invite", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 201 and send an invite when admin provides valid email and role", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        email: "jane@example.com",
        role: "TECHNICIAN",
        expiresAt: expect.any(String),
      },
    });
  });

  it("should call emailService.sendInvite with the recipient email", async () => {
    const admin = await createAdminUser();

    await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "jane@example.com", role: "MANAGER" });

    expect(sendInviteMock).toHaveBeenCalledTimes(1);
    expect(sendInviteMock).toHaveBeenCalledWith(
      "jane@example.com",
      expect.stringContaining("/auth/accept-invite?token="),
      "MANAGER",
    );
  });

  it("should return 409 when the email is already registered", async () => {
    const admin = await createAdminUser();
    await createTestUser({ email: "existing@example.com" });

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "existing@example.com", role: "TECHNICIAN" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("should not send an email when the invite fails due to conflict", async () => {
    const admin = await createAdminUser();
    await createTestUser({ email: "existing@example.com" });

    await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "existing@example.com", role: "TECHNICIAN" });

    expect(sendInviteMock).not.toHaveBeenCalled();
  });

  it("should return 403 when a manager tries to invite", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(manager)))
      .send({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(response.status).toBe(403);
  });

  it("should return 403 when a technician tries to invite", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(technician)))
      .send({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(response.status).toBe(403);
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app)
      .post("/api/v1/users/invite")
      .send({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(response.status).toBe(401);
  });

  it("should return 400 when role is ADMIN (not allowed via invite)", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "jane@example.com", role: "ADMIN" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when email is missing", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ role: "TECHNICIAN" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when email is malformed", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "not-an-email", role: "TECHNICIAN" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when role is missing", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "jane@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should not include the invite token in the response", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(response.body.data).not.toHaveProperty("token");
  });
});

describe("DELETE /api/v1/users/invites/:id", () => {
  it("should return 204 and remove the invite", async () => {
    const admin = await createAdminUser();
    const invite = await createTestInvite({ email: "to-cancel@example.com" });

    const response = await request(app)
      .delete(`/api/v1/users/invites/${invite.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
  });

  it("should no longer appear in pending-invites after cancellation", async () => {
    const admin = await createAdminUser();
    const invite = await createTestInvite({ email: "to-cancel@example.com" });

    await request(app)
      .delete(`/api/v1/users/invites/${invite.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    const pending = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(pending.body.data).toHaveLength(0);
  });

  it("should return 400 when the invite has already been accepted", async () => {
    const admin = await createAdminUser();
    const invite = await createTestInvite({ email: "used@example.com", usedAt: new Date() });

    const response = await request(app)
      .delete(`/api/v1/users/invites/${invite.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("should return 404 when the invite does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/users/invites/00000000-0000-0000-0000-000000000000`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });

  it("should return 403 for MANAGER", async () => {
    const manager = await createManagerUser();
    const invite = await createTestInvite();

    const response = await request(app)
      .delete(`/api/v1/users/invites/${invite.id}`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(403);
  });

  it("should return 401 when unauthenticated", async () => {
    const invite = await createTestInvite();

    const response = await request(app).delete(`/api/v1/users/invites/${invite.id}`);

    expect(response.status).toBe(401);
  });
});

describe("POST /api/v1/users/invite — deduplication", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 409 when a non-expired pending invite already exists for the email", async () => {
    const admin = await createAdminUser();
    await createTestInvite({ email: "jane@example.com" });

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("should succeed and replace an expired invite for the same email", async () => {
    const admin = await createAdminUser();
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await createTestInvite({ email: "jane@example.com", expiresAt: yesterday });

    const response = await request(app)
      .post("/api/v1/users/invite")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ email: "jane@example.com", role: "TECHNICIAN" });

    expect(response.status).toBe(201);

    const pending = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(pending.body.data).toHaveLength(1);
    expect(pending.body.data[0].isExpired).toBe(false);
  });
});

describe("GET /api/v1/users/pending-invites", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with an empty array when no invites exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });

  it("should return pending (unused) invites only", async () => {
    const admin = await createAdminUser();
    await createTestInvite({ email: "pending@example.com" });
    await createTestInvite({ email: "used@example.com", usedAt: new Date() });

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].email).toBe("pending@example.com");
  });

  it("should include isExpired: false for a fresh invite", async () => {
    const admin = await createAdminUser();
    await createTestInvite({ email: "fresh@example.com" });

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data[0].isExpired).toBe(false);
  });

  it("should include isExpired: true for an invite past its expiry", async () => {
    const admin = await createAdminUser();
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await createTestInvite({ email: "expired@example.com", expiresAt: yesterday });

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data[0].isExpired).toBe(true);
  });

  it("should return items in descending creation order", async () => {
    const admin = await createAdminUser();
    await createTestInvite({ email: "first@example.com" });
    await createTestInvite({ email: "second@example.com" });

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data[0].email).toBe("second@example.com");
    expect(response.body.data[1].email).toBe("first@example.com");
  });

  it("should not include the token in any invite", async () => {
    const admin = await createAdminUser();
    await createTestInvite({ email: "jane@example.com" });

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.body.data[0]).not.toHaveProperty("token");
  });

  it("should return 403 for MANAGER", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(403);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users/pending-invites")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app).get("/api/v1/users/pending-invites");

    expect(response.status).toBe(401);
  });
});
