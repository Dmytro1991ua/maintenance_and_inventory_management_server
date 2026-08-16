import request from "supertest";

import app from "../../../src/app";
import { authHeader, signTestAccessToken } from "../helpers/auth.helpers";
import { createTestChecklistTemplate } from "../helpers/task.helpers";
import { createAdminUser, createManagerUser, createTechnicianUser } from "../helpers/user.helpers";

describe("Checklist Templates — GET /api/v1/checklist-templates", () => {
  it("should return all templates for any authenticated user", async () => {
    const tech = await createTechnicianUser();
    await createTestChecklistTemplate("HVAC", ["Filter replaced?", "Unit tested?"]);
    await createTestChecklistTemplate("ELECTRICAL", ["Power isolated?", "Tested?"]);

    const response = await request(app)
      .get("/api/v1/checklist-templates")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);

    const hvac = response.body.data.find((t: { category: string }) => t.category === "HVAC");
    expect(hvac).toBeDefined();
    expect(hvac.items).toContain("Filter replaced?");
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app).get("/api/v1/checklist-templates");

    expect(response.status).toBe(401);
  });
});

describe("Checklist Templates — GET /api/v1/checklist-templates/:category", () => {
  it("should return a specific template by category", async () => {
    const tech = await createTechnicianUser();
    await createTestChecklistTemplate("PLUMBING", ["Water shut off?", "Leak tested?"]);

    const response = await request(app)
      .get("/api/v1/checklist-templates/PLUMBING")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBe("PLUMBING");
    expect(response.body.data.items).toContain("Water shut off?");
  });

  it("should return 404 for a category with no template", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/checklist-templates/TOOLS")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(404);
  });

  it("should return 400 for an invalid category", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/checklist-templates/INVALID_CATEGORY")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(400);
  });
});

describe("Checklist Templates — PATCH /api/v1/checklist-templates/:category", () => {
  it("should allow ADMIN to update a template", async () => {
    const admin = await createAdminUser();
    await createTestChecklistTemplate("SAFETY", ["Hazard contained?", "Area cleared?"]);

    const response = await request(app)
      .patch("/api/v1/checklist-templates/SAFETY")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ items: ["Hazard contained?", "Area cleared?", "Incident logged?"] });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(3);
    expect(response.body.data.items).toContain("Incident logged?");
  });

  it("should allow MANAGER to update a template", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .patch("/api/v1/checklist-templates/CHEMICALS")
      .set(authHeader(signTestAccessToken(manager)))
      .send({ items: ["PPE worn?", "Chemical applied correctly?"] });

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBe("CHEMICALS");
  });

  it("should return 403 when technician tries to update", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .patch("/api/v1/checklist-templates/HVAC")
      .set(authHeader(signTestAccessToken(tech)))
      .send({ items: ["Filter replaced?"] });

    expect(response.status).toBe(403);
  });

  it("should return 400 when items array is empty", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch("/api/v1/checklist-templates/HVAC")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ items: [] });

    expect(response.status).toBe(400);
  });

  it("should create a template when it does not yet exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch("/api/v1/checklist-templates/FASTENERS")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ items: ["Correct spec used?", "Torque applied?"] });

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBe("FASTENERS");
    expect(response.body.data.items).toHaveLength(2);
  });
});
