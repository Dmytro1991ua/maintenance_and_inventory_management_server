import request from "supertest";

import app from "../../../src/app";
import {
  authHeader,
  createTechnicianUser,
  createTestNotification,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/v1/notifications", () => {
  it("should return only the requesting user's own notifications", async () => {
    const user = await createTechnicianUser();
    const otherUser = await createTechnicianUser();

    await createTestNotification({ userId: user.id });
    await createTestNotification({ userId: otherUser.id });

    const response = await request(app)
      .get("/api/v1/notifications")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userId).toBe(user.id);
  });

  it("should filter by isRead", async () => {
    const user = await createTechnicianUser();

    await createTestNotification({ userId: user.id, isRead: true });
    await createTestNotification({ userId: user.id, isRead: false });

    const response = await request(app)
      .get("/api/v1/notifications?isRead=false")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].isRead).toBe(false);
  });

  it("should filter by type", async () => {
    const user = await createTechnicianUser();

    await createTestNotification({ userId: user.id, type: "LOW_STOCK" });
    await createTestNotification({ userId: user.id, type: "OUT_OF_STOCK" });
    await createTestNotification({ userId: user.id, type: "TASK_OVERDUE" });

    const response = await request(app)
      .get("/api/v1/notifications?type=TASK_OVERDUE")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].type).toBe("TASK_OVERDUE");
  });

  it("should filter OUT_OF_STOCK notifications independently", async () => {
    const user = await createTechnicianUser();

    await createTestNotification({ userId: user.id, type: "LOW_STOCK" });
    await createTestNotification({ userId: user.id, type: "OUT_OF_STOCK" });
    await createTestNotification({ userId: user.id, type: "TASK_OVERDUE" });

    const response = await request(app)
      .get("/api/v1/notifications?type=OUT_OF_STOCK")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].type).toBe("OUT_OF_STOCK");
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/notifications");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/notifications/unread-count", () => {
  it("should return the count of the user's unread notifications", async () => {
    const user = await createTechnicianUser();

    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: true });

    const response = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ count: 2 });
  });

  it("should not count another user's unread notifications", async () => {
    const user = await createTechnicianUser();
    const otherUser = await createTechnicianUser();

    await createTestNotification({ userId: otherUser.id, isRead: false });

    const response = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.body.data).toEqual({ count: 0 });
  });
});

describe("PATCH /api/v1/notifications/read-all", () => {
  it("should mark all of the user's own notifications as read", async () => {
    const user = await createTechnicianUser();

    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: false });

    const response = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ updated: 2 });
  });

  it("should not affect another user's notifications", async () => {
    const user = await createTechnicianUser();
    const otherUser = await createTechnicianUser();

    await createTestNotification({ userId: otherUser.id, isRead: false });

    const response = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.body.data).toEqual({ updated: 0 });
  });
});

describe("PATCH /api/v1/notifications/:id", () => {
  it("should allow a user to mark their own notification as read", async () => {
    const user = await createTechnicianUser();
    const notification = await createTestNotification({ userId: user.id, isRead: false });

    const response = await request(app)
      .patch(`/api/v1/notifications/${notification.id}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ isRead: true });

    expect(response.status).toBe(200);
    expect(response.body.data.isRead).toBe(true);
  });

  it("should return 403 when updating another user's notification", async () => {
    const user = await createTechnicianUser();
    const otherUser = await createTechnicianUser();
    const notification = await createTestNotification({ userId: otherUser.id });

    const response = await request(app)
      .patch(`/api/v1/notifications/${notification.id}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ isRead: true });

    expect(response.status).toBe(403);
  });

  it("should return 404 when the notification does not exist", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/notifications/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ isRead: true });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/v1/notifications/:id", () => {
  it("should allow a user to delete their own notification", async () => {
    const user = await createTechnicianUser();
    const notification = await createTestNotification({ userId: user.id });

    const response = await request(app)
      .delete(`/api/v1/notifications/${notification.id}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(204);
  });

  it("should return 403 when deleting another user's notification", async () => {
    const user = await createTechnicianUser();
    const otherUser = await createTechnicianUser();
    const notification = await createTestNotification({ userId: otherUser.id });

    const response = await request(app)
      .delete(`/api/v1/notifications/${notification.id}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(403);
  });

  it("should return 404 when the notification does not exist", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .delete(`/api/v1/notifications/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(404);
  });
});
