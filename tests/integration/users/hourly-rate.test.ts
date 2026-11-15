import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

type TestUser = Awaited<ReturnType<typeof createTechnicianUser>>;

const patchRate = (targetId: string, actor: TestUser, body: object) =>
  request(app)
    .patch(`/api/v1/users/${targetId}/hourly-rate`)
    .set(authHeader(signTestAccessToken(actor)))
    .send(body);

describe("PATCH /api/v1/users/:id/hourly-rate", () => {
  it("should let a manager set a rate", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();

    const response = await patchRate(tech.id, manager, { hourlyRate: "25" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: tech.id,
      userName: tech.userName,
      hourlyRate: "25.00",
    });
  });

  it("should let an admin set a rate, accepting a JSON number", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();

    const response = await patchRate(tech.id, admin, { hourlyRate: 27.5 });

    expect(response.body.data.hourlyRate).toBe("27.50");
  });

  it("should clear a rate with null", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    await patchRate(tech.id, manager, { hourlyRate: "25" });

    const response = await patchRate(tech.id, manager, { hourlyRate: null });

    expect(response.status).toBe(200);
    expect(response.body.data.hourlyRate).toBeNull();
  });

  it.each([
    ["a negative rate", { hourlyRate: "-5" }],
    ["three decimals", { hourlyRate: "25.123" }],
    ["too many digits", { hourlyRate: "100000" }],
    ["text", { hourlyRate: "abc" }],
    ["no rate field", {}],
    ["an unknown field", { hourlyRate: "25", status: "INACTIVE" }],
  ])("should reject %s", async (_label, body) => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();

    const response = await patchRate(tech.id, manager, body);

    expect(response.status).toBe(400);
  });

  it("should reject a technician, even for their own rate", async () => {
    const tech = await createTechnicianUser();

    const response = await patchRate(tech.id, tech, { hourlyRate: "999" });

    expect(response.status).toBe(403);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: tech.id } });
    expect(stored.hourlyRate).toBeNull();
  });

  it("should return 404 for an unknown user", async () => {
    const manager = await createManagerUser();

    expect((await patchRate(NONEXISTENT_ID, manager, { hourlyRate: "25" })).status).toBe(404);
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${NONEXISTENT_ID}/hourly-rate`)
      .send({ hourlyRate: "25" });

    expect(response.status).toBe(401);
  });

  it("should keep the rate out of the normal user responses", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    await patchRate(tech.id, manager, { hourlyRate: "25" });

    const byId = await request(app)
      .get(`/api/v1/users/${tech.id}`)
      .set(authHeader(signTestAccessToken(manager)));
    const list = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(manager)));
    const me = await request(app)
      .get("/api/v1/users/me")
      .set(authHeader(signTestAccessToken(tech)));

    expect(JSON.stringify([byId.body, list.body, me.body])).not.toContain("hourlyRate");
  });
});
