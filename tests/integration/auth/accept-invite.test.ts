import request from "supertest";

import app from "../../../src/app";
import { createTestInvite, createTestUser } from "../helpers";
import { Role } from "../../../src/generated/prisma/client";

describe("POST /api/v1/auth/accept-invite", () => {
  it("should return 201 and create a user with the role from the invite", async () => {
    const invite = await createTestInvite({ email: "jane@example.com", role: Role.MANAGER });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "janedoe", password: "Password123" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        userName: "janedoe",
        email: "jane@example.com",
      },
    });
  });

  it("should create the user with the role specified in the invite", async () => {
    const invite = await createTestInvite({ email: "manager@example.com", role: Role.MANAGER });

    await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "newmanager", password: "Password123" });

    // Verify the created user can log in and has the correct role
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "manager@example.com", password: "Password123" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.roles).toContain("MANAGER");
  });

  it("should never expose the password hash in the response", async () => {
    const invite = await createTestInvite({ email: "jane@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "janedoe", password: "Password123" });

    expect(response.body.data).not.toHaveProperty("password");
  });

  it("should return 404 when the token does not exist", async () => {
    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: "00000000-0000-0000-0000-000000000000", userName: "janedoe", password: "Password123" });

    expect(response.status).toBe(404);
  });

  it("should return 400 when the invite has already been used", async () => {
    const invite = await createTestInvite({
      email: "jane@example.com",
      usedAt: new Date("2026-07-24T00:00:00.000Z"),
    });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "janedoe", password: "Password123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("should return 400 when the invite has expired", async () => {
    const invite = await createTestInvite({
      email: "jane@example.com",
      expiresAt: new Date("2026-01-01T00:00:00.000Z"), // in the past
    });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "janedoe", password: "Password123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("should return 409 when the userName is already taken", async () => {
    await createTestUser({ userName: "takenname" });
    const invite = await createTestInvite({ email: "jane@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "takenname", password: "Password123" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("should return 400 when token is missing", async () => {
    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ userName: "janedoe", password: "Password123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when token is not a valid UUID", async () => {
    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: "not-a-uuid", userName: "janedoe", password: "Password123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when userName is missing", async () => {
    const invite = await createTestInvite({ email: "jane@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, password: "Password123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when password does not meet complexity rules", async () => {
    const invite = await createTestInvite({ email: "jane@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "janedoe", password: "weak" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should mark the invite as used so it cannot be accepted a second time", async () => {
    const invite = await createTestInvite({ email: "jane@example.com" });

    // First accept — should succeed
    await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "janedoe", password: "Password123" });

    // Second accept with the same token — should fail
    const secondResponse = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ token: invite.token, userName: "janedoe2", password: "Password123" });

    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.error.code).toBe("BAD_REQUEST");
  });
});
