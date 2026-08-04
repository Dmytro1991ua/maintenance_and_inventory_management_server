import { v4 as uuid } from "uuid";
import request from "supertest";

import app from "../../../src/app";
import { redis } from "../../../src/config";
import { getPasswordResetTokenKey } from "../../../src/modules/auth/auth.utils";
import { createTestUser } from "../helpers";

describe("POST /api/v1/auth/forgot-password", () => {
  it("should return 204 when the email belongs to a registered user", async () => {
    const user = await createTestUser({ email: "forgot@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: user.email });

    expect(response.status).toBe(204);
  });

  it("should return 204 even when the email is not registered", async () => {
    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    // No user enumeration — same response as a valid email
    expect(response.status).toBe(204);
  });

  it("should store a reset token in Redis when the email is registered", async () => {
    const user = await createTestUser({ email: "forgot-redis@example.com" });

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: user.email });

    // Find the token by scanning — in tests we can do this by calling reset-password
    // with a known token we injected, but here we verify indirectly via reset-password below.
    // Direct check: find any key matching the pattern
    const keys = await redis.keys("auth:password-reset:*");
    expect(keys.length).toBeGreaterThan(0);

    // Verify at least one key maps to our user
    const values = await Promise.all(keys.map((k) => redis.get(k)));
    expect(values).toContain(user.id);
  });

  it("should return 400 for an invalid email format", async () => {
    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when email is missing", async () => {
    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/reset-password", () => {
  const seedResetToken = async (userId: string): Promise<string> => {
    const token = uuid();
    await redis.set(getPasswordResetTokenKey(token), userId, "EX", 3600);
    return token;
  };

  it("should return 204 and update the password on a valid token", async () => {
    const user = await createTestUser({ email: "reset@example.com" });
    const token = await seedResetToken(user.id);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "NewPassword123" });

    expect(response.status).toBe(204);
  });

  it("should allow login with the new password after reset", async () => {
    const user = await createTestUser({ email: "reset-login@example.com" });
    const token = await seedResetToken(user.id);

    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "NewPassword123" });

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "NewPassword123" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.accessToken).toBeDefined();
  });

  it("should reject login with the old password after reset", async () => {
    const user = await createTestUser({ email: "reset-oldpass@example.com" });
    const token = await seedResetToken(user.id);

    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "NewPassword123" });

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });

    expect(loginResponse.status).toBe(401);
  });

  it("should revoke all active sessions after reset", async () => {
    const user = await createTestUser({ email: "reset-sessions@example.com" });

    // Establish an active session
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });

    const token = await seedResetToken(user.id);
    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "NewPassword123" });

    // The cookie from the earlier login must no longer work
    const refreshResponse = await agent.post("/api/v1/auth/refresh");
    expect(refreshResponse.status).toBe(401);
  });

  it("should consume the token so it cannot be reused", async () => {
    const user = await createTestUser({ email: "reset-reuse@example.com" });
    const token = await seedResetToken(user.id);

    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "NewPassword123" });

    // Second attempt with the same token must fail
    const secondResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "AnotherPassword456" });

    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.error.code).toBe("BAD_REQUEST");
  });

  it("should return 400 for an unknown token", async () => {
    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: "00000000-0000-0000-0000-000000000000", newPassword: "NewPassword123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("should return 400 when token is not a valid UUID", async () => {
    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: "not-a-uuid", newPassword: "NewPassword123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when newPassword does not meet complexity rules", async () => {
    const user = await createTestUser({ email: "reset-weakpass@example.com" });
    const token = await seedResetToken(user.id);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "weak" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when newPassword is missing", async () => {
    const user = await createTestUser({ email: "reset-nopass@example.com" });
    const token = await seedResetToken(user.id);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
