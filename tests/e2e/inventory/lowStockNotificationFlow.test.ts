import request from "supertest";

import app from "../../../src/app";
import { checkLowStock } from "../../../src/jobs/cron/inventory";
import { authHeader, createAdminUser, createManagerUser, signTestAccessToken } from "../../integration/helpers";

describe("low-stock notification flow", () => {
  it("should notify every ADMIN/MANAGER once, then notify again only after the previous notice is read", async () => {
    const admin = await createAdminUser();
    const manager = await createManagerUser();

    // Admin creates an item that's already below its minimum stock level
    const createResponse = await request(app)
      .post("/api/v1/inventory")
      .set(authHeader(signTestAccessToken(admin)))
      .send({ name: "Cordless Drill", serialNumber: "SN-LOWSTOCK-1", category: "TOOLS", quantity: 1, minStockLevel: 5 });

    expect(createResponse.status).toBe(201);
    const itemId = createResponse.body.data.id;

    // The scheduled job — not an HTTP endpoint — runs and fans out notifications
    await checkLowStock();

    const adminUnread = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(admin)));
    const managerUnread = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(manager)));

    expect(adminUnread.body.data).toEqual({ count: 1 });
    expect(managerUnread.body.data).toEqual({ count: 1 });

    const adminNotifications = await request(app)
      .get("/api/v1/notifications")
      .set(authHeader(signTestAccessToken(admin)));

    expect(adminNotifications.body.data[0]).toEqual(
      expect.objectContaining({
        type: "LOW_STOCK",
        relatedEntityId: itemId,
        message: expect.stringContaining("Cordless Drill"),
      }),
    );

    // Running the job again while the condition is unchanged must not spam
    // a second notification — the existing one is still unread/"active".
    await checkLowStock();

    const adminUnreadAfterRerun = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(admin)));

    expect(adminUnreadAfterRerun.body.data).toEqual({ count: 1 });

    // Admin reads the notification...
    const notificationId = adminNotifications.body.data[0].id;

    await request(app)
      .patch(`/api/v1/notifications/${notificationId}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ isRead: true });

    const adminUnreadAfterRead = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(admin)));

    expect(adminUnreadAfterRead.body.data).toEqual({ count: 0 });

    // ...so the next run, with the item still low on stock, notifies again.
    await checkLowStock();

    const adminUnreadAfterSecondRun = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeader(signTestAccessToken(admin)));

    expect(adminUnreadAfterSecondRun.body.data).toEqual({ count: 1 });
  });
});
