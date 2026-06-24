import request from "supertest";

import app from "../../../src/app";

describe("auth lifecycle", () => {
  it("should let a user register, login, access a protected resource, refresh, and logout", async () => {
    const agent = request.agent(app);

    // Register
    const registerResponse = await agent.post("/api/v1/auth/register").send({
      userName: "e2euser",
      email: "e2euser@example.com",
      password: "Password123",
    });

    expect(registerResponse.status).toBe(201);

    // Login
    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .send({ email: "e2euser@example.com", password: "Password123" });

    expect(loginResponse.status).toBe(200);
    const accessToken = loginResponse.body.data.accessToken;

    // Access a protected resource with the issued access token
    const meResponse = await agent
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.email).toBe("e2euser@example.com");

    // Rotate the refresh token
    const oldRefreshCookie = loginResponse.headers["set-cookie"]?.[0];
    const refreshResponse = await agent.post("/api/v1/auth/refresh");

    expect(refreshResponse.status).toBe(200);
    const newAccessToken = refreshResponse.body.data.accessToken;
    // The refresh token carries a random jti, so it always rotates to a new
    // value. The access token's byte value is incidental — jwt.sign is
    // deterministic, so an identical payload signed within the same second
    // (same UserInfo + truncated-to-seconds iat) legitimately produces an
    // identical string. That's not a security property worth asserting on.
    expect(refreshResponse.headers["set-cookie"]?.[0]).not.toBe(oldRefreshCookie);

    // New access token also works
    const meAfterRefresh = await agent
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${newAccessToken}`);

    expect(meAfterRefresh.status).toBe(200);

    // Logout
    const logoutResponse = await agent.post("/api/v1/auth/logout");

    expect(logoutResponse.status).toBe(204);

    // The (now-cleared) refresh cookie can no longer be used
    const refreshAfterLogout = await agent.post("/api/v1/auth/refresh");

    expect(refreshAfterLogout.status).toBe(401);
  });
});
