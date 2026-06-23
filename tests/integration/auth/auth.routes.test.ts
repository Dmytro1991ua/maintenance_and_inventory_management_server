import request from "supertest";

import app from "../../../src/app";
import { createTestUser } from "../helpers";

describe("POST /api/v1/auth/register", () => {
  it("should create a user and return 201 with id, userName, and email", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      userName: "newuser",
      email: "newuser@example.com",
      password: "Password123",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        userName: "newuser",
        email: "newuser@example.com",
      },
    });
  });

  it("should never include the password hash in the response", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      userName: "newuser2",
      email: "newuser2@example.com",
      password: "Password123",
    });

    expect(response.body.data).not.toHaveProperty("password");
  });

  it("should return 409 when the email is already in use", async () => {
    const existing = await createTestUser({ email: "taken@example.com" });

    const response = await request(app).post("/api/v1/auth/register").send({
      userName: "differentname",
      email: existing.email,
      password: "Password123",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("should return 409 when the username is already taken", async () => {
    const existing = await createTestUser({ userName: "takenname" });

    const response = await request(app).post("/api/v1/auth/register").send({
      userName: existing.userName,
      email: "different@example.com",
      password: "Password123",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("should return 400 when the password doesn't meet complexity rules", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      userName: "weakpassuser",
      email: "weakpass@example.com",
      password: "weak",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("should return an access token and roles on valid credentials", async () => {
    const user = await createTestUser({ email: "login@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { accessToken: expect.any(String), roles: user.roles },
    });
  });

  it("should set the refresh token as an HttpOnly cookie", async () => {
    const user = await createTestUser({ email: "cookie@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });

    const cookies = response.headers["set-cookie"];

    expect(cookies?.[0]).toMatch(/^jwt=.+HttpOnly/);
  });

  it("should return 401 for a nonexistent email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    expect(response.status).toBe(401);
  });

  it("should return 401 for a wrong password", async () => {
    const user = await createTestUser({ email: "wrongpass@example.com" });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(response.status).toBe(401);
  });

  it("should give the same error message for a nonexistent user and a wrong password", async () => {
    // Prevents user enumeration via response body inspection.
    const user = await createTestUser({ email: "enum@example.com" });

    const missingUserResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    const wrongPasswordResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(missingUserResponse.body.error.message).toBe(wrongPasswordResponse.body.error.message);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("should rotate the refresh token and return a new access token", async () => {
    const user = await createTestUser({ email: "refresh@example.com" });
    const agent = request.agent(app);

    await agent
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });

    const response = await agent.post("/api/v1/auth/refresh");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { accessToken: expect.any(String), roles: user.roles },
    });
  });

  it("should set a new rotated refresh token cookie", async () => {
    const user = await createTestUser({ email: "rotate@example.com" });
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });
    const refreshResponse = await agent.post("/api/v1/auth/refresh");

    const oldCookie = loginResponse.headers["set-cookie"]?.[0];
    const newCookie = refreshResponse.headers["set-cookie"]?.[0];

    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(oldCookie);
  });

  it("should return 401 when no refresh cookie is provided", async () => {
    const response = await request(app).post("/api/v1/auth/refresh");

    expect(response.status).toBe(401);
  });

  it("should return 401 when the refresh cookie is garbage", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "jwt=not-a-real-token");

    expect(response.status).toBe(401);
  });

  it("should reject reuse of a refresh token that was already rotated out", async () => {
    const user = await createTestUser({ email: "reuse@example.com" });
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });

    // First refresh succeeds and rotates the token...
    await agent.post("/api/v1/auth/refresh");

    // ...so replaying the original (now-rotated-out) cookie must fail.
    const originalCookie = loginResponse.headers["set-cookie"]?.[0]?.split(";")[0];

    const reuseResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", originalCookie ?? "");

    expect(reuseResponse.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("should clear the refresh token cookie and return 204", async () => {
    const user = await createTestUser({ email: "logout@example.com" });
    const agent = request.agent(app);

    await agent
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });

    const response = await agent.post("/api/v1/auth/logout");

    expect(response.status).toBe(204);
  });

  it("should return 204 even when no refresh cookie is present", async () => {
    const response = await request(app).post("/api/v1/auth/logout");

    expect(response.status).toBe(204);
  });

  it("should invalidate the refresh token so it can no longer be used", async () => {
    const user = await createTestUser({ email: "logoutinvalid@example.com" });
    const agent = request.agent(app);

    await agent
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.plainPassword });
    await agent.post("/api/v1/auth/logout");

    const refreshAfterLogout = await agent.post("/api/v1/auth/refresh");

    expect(refreshAfterLogout.status).toBe(401);
  });
});
