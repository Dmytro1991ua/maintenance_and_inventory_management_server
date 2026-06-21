import { NotificationType } from "../../../src/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "../../../src/errors";
import { buildNotification, notificationsRepositoryMock } from "../../mocks";
import { notificationsService } from "../../../src/modules/notifications/notifications.service";

jest.mock("../../../src/modules/notifications/notifications.repository", () => ({
  notificationsRepository: notificationsRepositoryMock,
}));

describe("notificationsService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should wrap the repository's unread count in a count object", async () => {
    notificationsRepositoryMock.countUnread.mockResolvedValue(7);

    const result = await notificationsService.countUnread("user-1");

    expect(result).toEqual({ count: 7 });
  });

  it("should wrap the repository's updated total in an updated object", async () => {
    notificationsRepositoryMock.markAllAsRead.mockResolvedValue(4);

    const result = await notificationsService.markAllAsRead("user-1");

    expect(result).toEqual({ updated: 4 });
  });

  it("should allow a user to mark their own notification as read", async () => {
    const mockNotification = buildNotification({ userId: "user-1", isRead: false });

    notificationsRepositoryMock.findById.mockResolvedValue(mockNotification);
    notificationsRepositoryMock.update.mockResolvedValue({ ...mockNotification, isRead: true });

    const result = await notificationsService.update("notification-1", { isRead: true }, "user-1");

    expect(result.isRead).toBe(true);
  });

  it("should throw ForbiddenError when updating another user's notification", async () => {
    const mockNotification = buildNotification({ userId: "user-1" });

    notificationsRepositoryMock.findById.mockResolvedValue(mockNotification);

    await expect(
      notificationsService.update("notification-1", { isRead: true }, "user-2"),
    ).rejects.toThrow(ForbiddenError);

    expect(notificationsRepositoryMock.update).not.toHaveBeenCalled();
  });

  it("should throw NotFoundError when notification does not exist", async () => {
    notificationsRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      notificationsService.update("nonexistent", { isRead: true }, "user-1"),
    ).rejects.toThrow(NotFoundError);
  });

  it("should allow a user to delete their own notification", async () => {
    const mockNotification = buildNotification({ userId: "user-1" });

    notificationsRepositoryMock.findById.mockResolvedValue(mockNotification);
    notificationsRepositoryMock.delete.mockResolvedValue(undefined);

    await notificationsService.delete("notification-1", "user-1");

    expect(notificationsRepositoryMock.delete).toHaveBeenCalledWith("notification-1");
  });

  it("should throw ForbiddenError when deleting another user's notification", async () => {
    const mockNotification = buildNotification({ userId: "user-1" });

    notificationsRepositoryMock.findById.mockResolvedValue(mockNotification);

    await expect(notificationsService.delete("notification-1", "user-2")).rejects.toThrow(
      ForbiddenError,
    );

    expect(notificationsRepositoryMock.delete).not.toHaveBeenCalled();
  });

  it("should create notifications that have no duplicate, skips ones that do", async () => {
    notificationsRepositoryMock.findActiveDuplicateKeys.mockResolvedValue(
      new Set(["user-2:item-1"]), // user-2 already has an unread notification about item-1
    );
    notificationsRepositoryMock.createMany.mockResolvedValue(1);

    const result = await notificationsService.createMany(NotificationType.LOW_STOCK, [
      {
        type: NotificationType.LOW_STOCK,
        message: "msg",
        userId: "user-1",
        relatedEntityId: "item-1",
      },
      {
        type: NotificationType.LOW_STOCK,
        message: "msg",
        userId: "user-2",
        relatedEntityId: "item-1",
      }, // duplicate
    ]);

    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(notificationsRepositoryMock.createMany).toHaveBeenCalledWith([
      {
        type: NotificationType.LOW_STOCK,
        message: "msg",
        userId: "user-1",
        relatedEntityId: "item-1",
      },
    ]);
  });

  it("should return early without calling createMany when all notifications are empty", async () => {
    const result = await notificationsService.createMany(NotificationType.LOW_STOCK, []);

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(notificationsRepositoryMock.createMany).not.toHaveBeenCalled();
  });

  it("should skip all notifications when every one is a duplicate", async () => {
    notificationsRepositoryMock.findActiveDuplicateKeys.mockResolvedValue(
      new Set(["user-1:item-1"]),
    );

    const result = await notificationsService.createMany(NotificationType.LOW_STOCK, [
      {
        type: NotificationType.LOW_STOCK,
        message: "msg",
        userId: "user-1",
        relatedEntityId: "item-1",
      },
    ]);

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(notificationsRepositoryMock.createMany).not.toHaveBeenCalled();
  });
});
