import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestAsset,
  createTestWorkOrderRequest,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("POST /api/v1/work-order-requests", () => {
  it("should let any authenticated user file a PENDING request", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/work-order-requests")
      .set(authHeader(signTestAccessToken(tech)))
      .send({ title: "AC leaking in Room 204", priority: "HIGH" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      title: "AC leaking in Room 204",
      priority: "HIGH",
      status: "PENDING",
      requestedBy: tech.id,
      requester: { id: tech.id },
      reviewedBy: null,
      taskId: null,
    });
  });

  it("should link an asset when provided", async () => {
    const tech = await createTechnicianUser();
    const asset = await createTestAsset();

    const response = await request(app)
      .post("/api/v1/work-order-requests")
      .set(authHeader(signTestAccessToken(tech)))
      .send({ title: "Pump noise", assetId: asset.id });

    expect(response.status).toBe(201);
    expect(response.body.data.asset).toMatchObject({ id: asset.id });
  });

  it("should 404 when the assetId does not exist", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/work-order-requests")
      .set(authHeader(signTestAccessToken(tech)))
      .send({ title: "Orphan", assetId: NONEXISTENT_ID });

    expect(response.status).toBe(404);
  });

  it("should reject self-set status or other unknown fields (strict schema)", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/work-order-requests")
      .set(authHeader(signTestAccessToken(tech)))
      .send({ title: "Sneaky", status: "APPROVED" });

    expect(response.status).toBe(400);
  });

  it("should return 400 for an empty title", async () => {
    const tech = await createTechnicianUser();

    const response = await request(app)
      .post("/api/v1/work-order-requests")
      .set(authHeader(signTestAccessToken(tech)))
      .send({ title: "" });

    expect(response.status).toBe(400);
  });

  it("should return 401 without a token", async () => {
    const response = await request(app).post("/api/v1/work-order-requests").send({ title: "Anon" });

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/work-order-requests", () => {
  it("should show a MANAGER the whole queue", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    await createTestWorkOrderRequest({ requestedBy: tech.id });
    await createTestWorkOrderRequest({ requestedBy: manager.id });

    const response = await request(app)
      .get("/api/v1/work-order-requests")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toMatchObject({ total: 2, page: 1, limit: 20 });
  });

  it("should show a TECHNICIAN only their own requests", async () => {
    const tech = await createTechnicianUser();
    const otherTech = await createTechnicianUser();
    await createTestWorkOrderRequest({ requestedBy: tech.id, title: "Mine" });
    await createTestWorkOrderRequest({ requestedBy: otherTech.id, title: "Theirs" });

    const response = await request(app)
      .get("/api/v1/work-order-requests")
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Mine");
  });

  it("should filter by status", async () => {
    const manager = await createManagerUser();
    await createTestWorkOrderRequest({ requestedBy: manager.id, status: "PENDING" });
    await createTestWorkOrderRequest({ requestedBy: manager.id, status: "REJECTED" });

    const response = await request(app)
      .get("/api/v1/work-order-requests?status=REJECTED")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe("REJECTED");
  });

  it("should return 401 without a token", async () => {
    const response = await request(app).get("/api/v1/work-order-requests");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/work-order-requests/:id", () => {
  it("should let the requester view their own", async () => {
    const tech = await createTechnicianUser();
    const req = await createTestWorkOrderRequest({ requestedBy: tech.id });

    const response = await request(app)
      .get(`/api/v1/work-order-requests/${req.id}`)
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(req.id);
  });

  it("should let an ADMIN view anyone's", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    const req = await createTestWorkOrderRequest({ requestedBy: tech.id });

    const response = await request(app)
      .get(`/api/v1/work-order-requests/${req.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
  });

  it("should forbid a technician from viewing someone else's", async () => {
    const tech = await createTechnicianUser();
    const otherTech = await createTechnicianUser();
    const req = await createTestWorkOrderRequest({ requestedBy: otherTech.id });

    const response = await request(app)
      .get(`/api/v1/work-order-requests/${req.id}`)
      .set(authHeader(signTestAccessToken(tech)));

    expect(response.status).toBe(403);
  });

  it("should return 404 for an unknown request", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get(`/api/v1/work-order-requests/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/work-order-requests/:id/approve", () => {
  it("should create a task, link it, and mark the request APPROVED", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    const asset = await createTestAsset();
    const req = await createTestWorkOrderRequest({
      requestedBy: tech.id,
      title: "Fix the pump",
      category: "PLUMBING",
      assetId: asset.id,
    });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/approve`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "APPROVED",
      reviewedBy: manager.id,
    });
    expect(response.body.data.taskId).toBeTruthy();

    const task = await prisma.task.findUnique({ where: { id: response.body.data.taskId } });
    expect(task).toMatchObject({
      title: "Fix the pump",
      category: "PLUMBING",
      assetId: asset.id,
    });
  });

  it("should assign the created task when assignedTo is given", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    const req = await createTestWorkOrderRequest({ requestedBy: tech.id });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/approve`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ assignedTo: tech.id });

    expect(response.status).toBe(200);
    const task = await prisma.task.findUnique({ where: { id: response.body.data.taskId } });
    expect(task?.assignedTo).toBe(tech.id);
  });

  it("should 404 when assignedTo does not exist", async () => {
    const manager = await createManagerUser();
    const req = await createTestWorkOrderRequest({ requestedBy: manager.id });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/approve`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ assignedTo: NONEXISTENT_ID });

    expect(response.status).toBe(404);
    // Request stays PENDING — nothing was approved
    const stored = await prisma.workOrderRequest.findUnique({ where: { id: req.id } });
    expect(stored?.status).toBe("PENDING");
  });

  it("should forbid a TECHNICIAN from approving", async () => {
    const tech = await createTechnicianUser();
    const req = await createTestWorkOrderRequest({ requestedBy: tech.id });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/approve`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({});

    expect(response.status).toBe(403);
  });

  it("should 409 when the request was already reviewed", async () => {
    const manager = await createManagerUser();
    const req = await createTestWorkOrderRequest({ requestedBy: manager.id, status: "APPROVED" });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/approve`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({});

    expect(response.status).toBe(409);
  });

  it("should 404 for an unknown request", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${NONEXISTENT_ID}/approve`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({});

    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/work-order-requests/:id/reject", () => {
  it("should mark the request REJECTED with a reason", async () => {
    const manager = await createManagerUser();
    const tech = await createTechnicianUser();
    const req = await createTestWorkOrderRequest({ requestedBy: tech.id });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/reject`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ reason: "Duplicate of an existing scheduled task" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Duplicate of an existing scheduled task",
      reviewedBy: manager.id,
      taskId: null,
    });
  });

  it("should require a reason", async () => {
    const manager = await createManagerUser();
    const req = await createTestWorkOrderRequest({ requestedBy: manager.id });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/reject`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({});

    expect(response.status).toBe(400);
  });

  it("should 409 when already reviewed", async () => {
    const manager = await createManagerUser();
    const req = await createTestWorkOrderRequest({ requestedBy: manager.id, status: "REJECTED" });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/reject`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ reason: "Again" });

    expect(response.status).toBe(409);
  });

  it("should forbid a TECHNICIAN from rejecting", async () => {
    const tech = await createTechnicianUser();
    const req = await createTestWorkOrderRequest({ requestedBy: tech.id });

    const response = await request(app)
      .post(`/api/v1/work-order-requests/${req.id}/reject`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ reason: "no" });

    expect(response.status).toBe(403);
  });
});
