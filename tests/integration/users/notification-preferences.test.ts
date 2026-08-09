import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { NotificationType } from "../../../src/generated/prisma/client";
import { notificationsService } from "../../../src/modules/notifications/notifications.service";
import { authHeader, signTestAccessToken } from "../helpers/auth.helpers";
import { createAdminUser, createManagerUser, createTestUser } from "../helpers";

describe("GET /api/v1/users/me/notification-preferences", () => {
  it("should return 200 with all types enabled for a new user", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .get("/api/v1/users/me/notification-preferences")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { LOW_STOCK: true, OUT_OF_STOCK: true, TASK_OVERDUE: true },
    });
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app).get("/api/v1/users/me/notification-preferences");

    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/v1/users/me/notification-preferences", () => {
  it("should return 200 with the updated preferences", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(signTestAccessToken(user)))
      .send({ TASK_OVERDUE: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { LOW_STOCK: true, OUT_OF_STOCK: true, TASK_OVERDUE: false },
    });
  });

  it("should merge — unset keys stay at their previous value", async () => {
    const user = await createTestUser();
    const token = signTestAccessToken(user);

    // Disable LOW_STOCK first
    await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(token))
      .send({ LOW_STOCK: false });

    // Then disable OUT_OF_STOCK without touching LOW_STOCK
    await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(token))
      .send({ OUT_OF_STOCK: false });

    const response = await request(app)
      .get("/api/v1/users/me/notification-preferences")
      .set(authHeader(token));

    expect(response.body.data).toEqual({
      LOW_STOCK: false,
      OUT_OF_STOCK: false,
      TASK_OVERDUE: true,
    });
  });

  it("should allow re-enabling a previously disabled type", async () => {
    const user = await createTestUser();
    const token = signTestAccessToken(user);

    await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(token))
      .send({ TASK_OVERDUE: false });

    const response = await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(token))
      .send({ TASK_OVERDUE: true });

    expect(response.body.data.TASK_OVERDUE).toBe(true);
  });

  it("should return 400 for unknown keys", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(signTestAccessToken(user)))
      .send({ UNKNOWN_TYPE: false });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when a value is not a boolean", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(signTestAccessToken(user)))
      .send({ TASK_OVERDUE: "yes" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .send({ TASK_OVERDUE: false });

    expect(response.status).toBe(401);
  });
});

describe("Notification preference guard in createMany", () => {
  it("should not create TASK_OVERDUE notifications for users who opted out", async () => {
    const user = await createTestUser();
    const token = signTestAccessToken(user);

    // Opt out of TASK_OVERDUE
    await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(token))
      .send({ TASK_OVERDUE: false });

    const result = await notificationsService.createMany(NotificationType.TASK_OVERDUE, [
      { type: NotificationType.TASK_OVERDUE, message: "Task overdue", userId: user.id, relatedEntityId: "task-1" },
    ]);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);

    const saved = await prisma.notification.findFirst({ where: { userId: user.id } });
    expect(saved).toBeNull();
  });

  it("should create TASK_OVERDUE notifications for users who have it enabled", async () => {
    const user = await createTestUser();

    // Default — all types enabled
    const result = await notificationsService.createMany(NotificationType.TASK_OVERDUE, [
      { type: NotificationType.TASK_OVERDUE, message: "Task overdue", userId: user.id, relatedEntityId: "task-2" },
    ]);

    expect(result.created).toBe(1);

    const saved = await prisma.notification.findFirst({ where: { userId: user.id } });
    expect(saved).not.toBeNull();
  });

  it("should filter recipients selectively — enabled users get notified, opted-out ones do not", async () => {
    const manager1 = await createManagerUser();
    const manager2 = await createManagerUser();

    // manager2 opts out of LOW_STOCK
    await request(app)
      .patch("/api/v1/users/me/notification-preferences")
      .set(authHeader(signTestAccessToken(manager2)))
      .send({ LOW_STOCK: false });

    await notificationsService.createMany(NotificationType.LOW_STOCK, [
      { type: NotificationType.LOW_STOCK, message: "Low stock alert", userId: manager1.id, relatedEntityId: "item-1" },
      { type: NotificationType.LOW_STOCK, message: "Low stock alert", userId: manager2.id, relatedEntityId: "item-1" },
    ]);

    const [n1, n2] = await Promise.all([
      prisma.notification.findFirst({ where: { userId: manager1.id, type: "LOW_STOCK" } }),
      prisma.notification.findFirst({ where: { userId: manager2.id, type: "LOW_STOCK" } }),
    ]);

    expect(n1).not.toBeNull();
    expect(n2).toBeNull();
  });

  it("should still apply deduplication for users who have the type enabled", async () => {
    const admin = await createAdminUser();

    // First notification — should be created
    await notificationsService.createMany(NotificationType.OUT_OF_STOCK, [
      { type: NotificationType.OUT_OF_STOCK, message: "Out of stock", userId: admin.id, relatedEntityId: "item-2" },
    ]);

    // Second call with same entity — should be deduplicated (not duplicated)
    const result = await notificationsService.createMany(NotificationType.OUT_OF_STOCK, [
      { type: NotificationType.OUT_OF_STOCK, message: "Out of stock", userId: admin.id, relatedEntityId: "item-2" },
    ]);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
