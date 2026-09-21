import { NotificationType, Prisma, Role } from "../../../../../src/generated/prisma/client";
import { loggerMock, reordersRepositoryMock, usersRepositoryMock } from "../../../../mocks";

jest.mock("../../../../../src/modules/reorders/reorders.repository", () => ({
  reordersRepository: reordersRepositoryMock,
}));

jest.mock("../../../../../src/modules/users/users.repository", () => ({
  usersRepository: usersRepositoryMock,
}));

jest.mock("../../../../../src/modules/notifications/notifications.service", () => ({
  notificationsService: { createMany: jest.fn() },
}));

jest.mock("../../../../../src/config", () => ({
  logger: loggerMock,
}));

import { checkReorders } from "../../../../../src/jobs/cron/inventory/checkReorders";
import { notificationsService } from "../../../../../src/modules/notifications/notifications.service";

const createManyMock = notificationsService.createMany as jest.MockedFunction<
  typeof notificationsService.createMany
>;

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  name: "Cordless Drill",
  quantity: 2,
  minStockLevel: 5,
  reorderPoint: null,
  reorderQuantity: null,
  ...overrides,
});

describe("checkReorders", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should raise a reorder and notify ADMIN/MANAGER recipients for each candidate", async () => {
    reordersRepositoryMock.findItemsNeedingReorder.mockResolvedValue([buildItem()]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }, { id: "manager-1" }]);
    reordersRepositoryMock.raise.mockResolvedValue({ id: "reorder-1" });

    await checkReorders();

    expect(usersRepositoryMock.findByRoles).toHaveBeenCalledWith([Role.ADMIN, Role.MANAGER]);
    // reorderQuantity null → falls back to minStockLevel (5).
    expect(reordersRepositoryMock.raise).toHaveBeenCalledWith({
      inventoryItemId: "item-1",
      quantity: 5,
      raisedBy: null,
    });
    expect(createManyMock).toHaveBeenCalledWith(NotificationType.REORDER_RAISED, [
      expect.objectContaining({ userId: "admin-1", relatedEntityId: "reorder-1" }),
      expect.objectContaining({ userId: "manager-1", relatedEntityId: "reorder-1" }),
    ]);
  });

  it("should use the configured reorderQuantity when set", async () => {
    reordersRepositoryMock.findItemsNeedingReorder.mockResolvedValue([
      buildItem({ reorderQuantity: 30 }),
    ]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);
    reordersRepositoryMock.raise.mockResolvedValue({ id: "reorder-1" });

    await checkReorders();

    expect(reordersRepositoryMock.raise).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 30 }),
    );
  });

  it("should do nothing when no items need reordering", async () => {
    reordersRepositoryMock.findItemsNeedingReorder.mockResolvedValue([]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);

    await checkReorders();

    expect(reordersRepositoryMock.raise).not.toHaveBeenCalled();
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("should skip an item whose reorder loses the unique-index race (P2002)", async () => {
    reordersRepositoryMock.findItemsNeedingReorder.mockResolvedValue([
      buildItem({ id: "item-1" }),
      buildItem({ id: "item-2" }),
    ]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);
    reordersRepositoryMock.raise
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "7.8.0",
        }),
      )
      .mockResolvedValueOnce({ id: "reorder-2" });

    await checkReorders();

    // First item raced and was skipped; only the second notifies.
    expect(createManyMock).toHaveBeenCalledTimes(1);
    expect(createManyMock).toHaveBeenCalledWith(NotificationType.REORDER_RAISED, [
      expect.objectContaining({ relatedEntityId: "reorder-2" }),
    ]);
  });

  it("should still raise reorders when there are no recipients to notify", async () => {
    reordersRepositoryMock.findItemsNeedingReorder.mockResolvedValue([buildItem()]);
    usersRepositoryMock.findByRoles.mockResolvedValue([]);
    reordersRepositoryMock.raise.mockResolvedValue({ id: "reorder-1" });

    await checkReorders();

    expect(reordersRepositoryMock.raise).toHaveBeenCalledTimes(1);
    expect(createManyMock).not.toHaveBeenCalled();
  });
});
