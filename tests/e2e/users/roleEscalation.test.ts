import request from "supertest";

import app from "../../../src/app";
import { authHeader, createAdminUser, signTestAccessToken } from "../../integration/helpers";

describe("role escalation", () => {
  it("should apply a promoted role to the existing token at once", async () => {
    const admin = await createAdminUser();
    const agent = request.agent(app);

    // Register and login as a fresh technician
    await agent.post("/api/v1/auth/register").send({
      userName: "futuremanager",
      email: "futuremanager@example.com",
      password: "Password123",
    });

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .send({ email: "futuremanager@example.com", password: "Password123" });

    const technicianToken = loginResponse.body.data.accessToken;

    // TECHNICIAN cannot list users
    const deniedResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${technicianToken}`);

    expect(deniedResponse.status).toBe(403);

    // Admin promotes them to MANAGER
    const registeredUserId = (
      await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${technicianToken}`)
    ).body.data.id;

    const promoteResponse = await request(app)
      .patch(`/api/v1/users/${registeredUserId}/roles`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ roles: ["MANAGER"] });

    expect(promoteResponse.status).toBe(200);

    // Roles are read from the database on each request, so the old token
    // already has the new role.
    const promotedResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${technicianToken}`);

    expect(promotedResponse.status).toBe(200);

    // A fresh login also reflects the updated role
    const reloginResponse = await agent
      .post("/api/v1/auth/login")
      .send({ email: "futuremanager@example.com", password: "Password123" });

    const managerToken = reloginResponse.body.data.accessToken;
    expect(reloginResponse.body.data.roles).toEqual(["MANAGER"]);

    const allowedResponse = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(allowedResponse.status).toBe(200);
  });
});
