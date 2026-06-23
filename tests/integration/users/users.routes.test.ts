import request from "supertest";

import app from "../../../src/app";
import { authHeader, createAdminUser, createManagerUser, createTechnicianUser, createTestUser, signTestAccessToken } from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/v1/users", () => {
  it("should return a paginated list of users for ADMIN", async () => {
    const admin = await createAdminUser();
    await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toEqual({
      total: 2,
      page: 1,
      limit: 20,
      pages: 1,
    });
  });

  it("should return a list for MANAGER", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/users");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/users/me", () => {
  it("should return the requesting user's own profile", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users/me")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(user.id);
    expect(response.body.data).not.toHaveProperty("password");
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/users/me");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/users/:id", () => {
  it("should return the user for ADMIN", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(target.id);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 404 for a nonexistent user", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get(`/api/v1/users/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/users/:id", () => {
  it("should allow a user to update their own profile", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ userName: "updatedname" });

    expect(response.status).toBe(200);
    expect(response.body.data.userName).toBe("updatedname");
  });

  it("should allow ADMIN to update another user's profile", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ userName: "adminupdated" });

    expect(response.status).toBe(200);
    expect(response.body.data.userName).toBe("adminupdated");
  });

  it("should return 403 when a non-admin tries to update another user's profile", async () => {
    const technician = await createTechnicianUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ userName: "hacked" });

    expect(response.status).toBe(403);
  });

  it("should return 409 when the new email is already in use", async () => {
    const user = await createTechnicianUser();
    const other = await createTestUser({ email: "other-taken@example.com" });

    const response = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ email: other.email });

    expect(response.status).toBe(409);
  });

  it("should return 404 when the target user does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/users/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ userName: "doesnotmatter" });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/users/:id/roles", () => {
  it("should update roles for ADMIN", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ roles: ["MANAGER"] });

    expect(response.status).toBe(200);
    expect(response.body.data.roles).toEqual(["MANAGER"]);
  });

  it("should return 403 for non-admin", async () => {
    const manager = await createManagerUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ roles: ["ADMIN"] });

    expect(response.status).toBe(403);
  });

  it("should return 404 when the target user does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/users/${NONEXISTENT_ID}/roles`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ roles: ["MANAGER"] });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/v1/users/:id", () => {
  it("should allow ADMIN to delete another user", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .delete(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
  });

  it("should return 403 when ADMIN tries to delete their own account", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/users/${admin.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(403);
  });

  it("should return 403 for non-admin", async () => {
    const technician = await createTechnicianUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .delete(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 404 when the target user does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/users/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});
