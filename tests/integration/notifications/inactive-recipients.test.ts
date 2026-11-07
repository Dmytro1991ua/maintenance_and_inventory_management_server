import { prisma } from "../../../src/config";
import { checkLowStock } from "../../../src/jobs/cron/inventory/checkLowStock";
import { checkMeterDueSoon } from "../../../src/jobs/cron/tasks/checkMeterDueSoon";
import { notificationsService } from "../../../src/modules/notifications/notifications.service";
import {
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestInventoryItem,
  createTestMeter,
  createTestMeterSchedule,
} from "../helpers";

const inbox = (userId: string) => prisma.notification.findMany({ where: { userId } });

describe("notifications for inactive users", () => {
  it("should not create a notification for an inactive user, but still for an active one", async () => {
    const active = await createManagerUser();
    const inactive = await createManagerUser({ status: "INACTIVE" });

    const result = await notificationsService.createMany("LOW_STOCK", [
      { type: "LOW_STOCK", message: "Low", userId: active.id, relatedEntityId: "item-1" },
      { type: "LOW_STOCK", message: "Low", userId: inactive.id, relatedEntityId: "item-1" },
    ]);

    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(await inbox(active.id)).toHaveLength(1);
    expect(await inbox(inactive.id)).toHaveLength(0);
  });

  it("should apply to any recipient, not only managers", async () => {
    const technician = await createTechnicianUser({ status: "INACTIVE" });

    const result = await notificationsService.createMany("TASK_OVERDUE", [
      { type: "TASK_OVERDUE", message: "Late", userId: technician.id, relatedEntityId: "task-1" },
    ]);

    expect(result).toEqual({ created: 0, skipped: 1 });
  });

  it("should resume once the user is active again", async () => {
    const user = await createManagerUser({ status: "INACTIVE" });
    const send = () =>
      notificationsService.createMany("LOW_STOCK", [
        { type: "LOW_STOCK", message: "Low", userId: user.id, relatedEntityId: "item-1" },
      ]);

    await send();
    await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    const result = await send();

    expect(result.created).toBe(1);
    expect(await inbox(user.id)).toHaveLength(1);
  });

  it("should leave an inactive manager out of the low-stock alert", async () => {
    const active = await createManagerUser();
    const admin = await createAdminUser({ status: "INACTIVE" });
    await createTestInventoryItem({ quantity: 1, minStockLevel: 5 });

    await checkLowStock();

    expect(await inbox(active.id)).toHaveLength(1);
    expect(await inbox(admin.id)).toHaveLength(0);
  });

  it("should not mark a meter reminder sent while every manager is inactive, and send it on return", async () => {
    const manager = await createManagerUser({ status: "INACTIVE" });
    const meter = await createTestMeter({ currentReading: 980 });
    const schedule = await createTestMeterSchedule({
      meterId: meter.id,
      intervalReading: 250,
      firstDueReading: 1000,
      createdBy: (await createTechnicianUser()).id,
    });

    await checkMeterDueSoon();

    expect(await inbox(manager.id)).toHaveLength(0);
    const stored = await prisma.recurringTask.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.reminderSentForReading).toBeNull();

    await prisma.user.update({ where: { id: manager.id }, data: { status: "ACTIVE" } });
    await checkMeterDueSoon();

    expect(await inbox(manager.id)).toHaveLength(1);
  });
});
