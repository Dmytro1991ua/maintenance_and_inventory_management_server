import request from "supertest";

import app from "../../../src/app";

jest.mock("../../../src/shared/email.service", () => ({
  emailService: { sendTaskAssignment: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../../src/shared/storage.service", () => ({
  storageService: {
    uploadTaskPhoto: jest
      .fn()
      .mockResolvedValue("https://storage.example.com/tasks/task-1/before-123.jpg"),
    uploadAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
  },
}));

import { authHeader, signTestAccessToken } from "../helpers/auth.helpers";
import { createTestInventoryItem } from "../helpers/inventory.helpers";
import { createTestChecklistTemplate, createTestTask } from "../helpers/task.helpers";
import { createAdminUser, createTechnicianUser } from "../helpers/user.helpers";

describe("Task completion — POST /api/v1/tasks/:id/before-photo", () => {
  it("should upload before photo for assigned technician", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/before-photo`)
      .set(authHeader(signTestAccessToken(tech)))
      .attach("photo", Buffer.from("fake-image"), {
        filename: "before.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.beforePhotoUrl).toBeTruthy();
    // afterPhotoUrl not set yet
    expect(response.body.data.afterPhotoUrl).toBeNull();
  });

  it("should allow admin to upload before photo for any task", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/before-photo`)
      .set(authHeader(signTestAccessToken(admin)))
      .attach("photo", Buffer.from("fake-image"), {
        filename: "before.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.beforePhotoUrl).toBeTruthy();
  });

  it("should return 403 when technician is not assigned to the task", async () => {
    const tech = await createTechnicianUser();
    const otherTech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: otherTech.id });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/before-photo`)
      .set(authHeader(signTestAccessToken(tech)))
      .attach("photo", Buffer.from("fake-image"), {
        filename: "before.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(403);
  });

  it("should return 400 when no file is provided", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/before-photo`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(400);
  });
});

describe("Task completion — POST /api/v1/tasks/:id/after-photo", () => {
  it("should upload after photo for assigned technician", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/after-photo`)
      .set(authHeader(signTestAccessToken(tech)))
      .attach("photo", Buffer.from("fake-image"), {
        filename: "after.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.afterPhotoUrl).toBeTruthy();
  });
});

describe("Task completion — POST /api/v1/tasks/:id/complete", () => {
  it("should complete a task with no category and no parts", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({
      assignedTo: tech.id,
      afterPhotoUrl: "https://storage.example.com/tasks/task-1/after-123.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: [], partsUsed: [] });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("DONE");
    expect(response.body.data.partsUsed).toHaveLength(0);
  });

  it("should return 400 when after photo is missing", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({ assignedTo: tech.id });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: [], partsUsed: [] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/after photo/i);
  });

  it("should return 400 when checklist is incomplete for a categorised task", async () => {
    const tech = await createTechnicianUser();
    await createTestChecklistTemplate("HVAC", ["Filter replaced?", "Unit tested?"]);
    const task = await createTestTask({
      assignedTo: tech.id,
      category: "HVAC",
      afterPhotoUrl: "https://storage.example.com/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: ["Filter replaced?"], partsUsed: [] }); // missing "Unit tested?"

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/checklist incomplete/i);
  });

  it("should complete when all checklist items are checked", async () => {
    const tech = await createTechnicianUser();
    await createTestChecklistTemplate("HVAC", ["Filter replaced?", "Unit tested?"]);
    const task = await createTestTask({
      assignedTo: tech.id,
      category: "HVAC",
      afterPhotoUrl: "https://storage.example.com/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: ["Filter replaced?", "Unit tested?"], partsUsed: [] });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("DONE");
  });

  it("should complete with parts used and decrement inventory", async () => {
    const admin = await createAdminUser();
    const tech = await createTechnicianUser();
    const item = await createTestInventoryItem({ quantity: 10, category: "HVAC" });
    const task = await createTestTask({
      assignedTo: tech.id,
      afterPhotoUrl: "https://storage.example.com/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: [], partsUsed: [{ inventoryItemId: item.id, quantity: 3 }] });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("DONE");
    expect(response.body.data.partsUsed).toHaveLength(1);
    expect(response.body.data.partsUsed[0].inventoryItemId).toBe(item.id);
    expect(response.body.data.partsUsed[0].quantity).toBe(3);

    // Verify inventory was decremented
    const inventoryResponse = await request(app)
      .get(`/api/v1/inventory/${item.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(inventoryResponse.body.data.quantity).toBe(7);
  });

  it("should return 409 when insufficient inventory stock", async () => {
    const tech = await createTechnicianUser();
    const item = await createTestInventoryItem({ quantity: 2, category: "HVAC" });
    const task = await createTestTask({
      assignedTo: tech.id,
      afterPhotoUrl: "https://storage.example.com/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: [], partsUsed: [{ inventoryItemId: item.id, quantity: 5 }] });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/insufficient stock/i);
  });

  it("should return 409 when task is already completed", async () => {
    const tech = await createTechnicianUser();
    const task = await createTestTask({
      assignedTo: tech.id,
      status: "DONE",
      afterPhotoUrl: "https://storage.example.com/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: [], partsUsed: [] });

    expect(response.status).toBe(409);
  });

  it("should return 403 when technician is not assigned to task", async () => {
    const tech = await createTechnicianUser();
    const otherTech = await createTechnicianUser();
    const task = await createTestTask({
      assignedTo: otherTech.id,
      afterPhotoUrl: "https://storage.example.com/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(tech)))
      .send({ checklist: [], partsUsed: [] });

    expect(response.status).toBe(403);
  });

  it("should allow admin to complete any task", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask({
      afterPhotoUrl: "https://storage.example.com/after.jpg",
    });

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ checklist: [], partsUsed: [] });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("DONE");
  });
});
