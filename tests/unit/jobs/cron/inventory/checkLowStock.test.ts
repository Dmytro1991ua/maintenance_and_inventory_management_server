import { NotificationType, Role } from "../../../../../src/generated/prisma/client";
import { buildInventoryItem, inventoryRepositoryMock, loggerMock, usersRepositoryMock } from "../../../../mocks";

jest.mock("../../../../../src/modules/inventory/inventory.repository", () => ({
  inventoryRepository: inventoryRepositoryMock,
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

import { notificationsService } from "../../../../../src/modules/notifications/notifications.service";
import { checkLowStock } from "../../../../../src/jobs/cron/inventory/checkLowStock";

const createManyMock = notificationsService.createMany as jest.MockedFunction<
  typeof notificationsService.createMany
>;

describe("checkLowStock", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create one LOW_STOCK notification per recipient for each low-stock item", async () => {
    const item = buildInventoryItem({ id: "item-1", name: "Cordless Drill", quantity: 2 });

    inventoryRepositoryMock.findLowStock.mockResolvedValue([item]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }, { id: "manager-1" }]);

    await checkLowStock();

    expect(usersRepositoryMock.findByRoles).toHaveBeenCalledWith([Role.ADMIN, Role.MANAGER]);
    expect(createManyMock).toHaveBeenCalledWith(NotificationType.LOW_STOCK, [
      expect.objectContaining({ userId: "admin-1", relatedEntityId: "item-1" }),
      expect.objectContaining({ userId: "manager-1", relatedEntityId: "item-1" }),
    ]);
  });

  it("should call createMany once per low-stock item", async () => {
    const itemA = buildInventoryItem({ id: "item-a" });
    const itemB = buildInventoryItem({ id: "item-b" });

    inventoryRepositoryMock.findLowStock.mockResolvedValue([itemA, itemB]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);

    await checkLowStock();

    expect(createManyMock).toHaveBeenCalledTimes(2);
  });

  it("should not notify anyone when there are no low-stock items", async () => {
    inventoryRepositoryMock.findLowStock.mockResolvedValue([]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);

    await checkLowStock();

    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("should not notify anyone when there are no ADMIN/MANAGER recipients", async () => {
    inventoryRepositoryMock.findLowStock.mockResolvedValue([buildInventoryItem()]);
    usersRepositoryMock.findByRoles.mockResolvedValue([]);

    await checkLowStock();

    expect(createManyMock).not.toHaveBeenCalled();
  });
});
