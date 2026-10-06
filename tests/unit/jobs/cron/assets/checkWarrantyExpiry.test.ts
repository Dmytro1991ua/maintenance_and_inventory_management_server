import { NotificationType, Role } from "../../../../../src/generated/prisma/client";
import { assetsRepositoryMock, loggerMock, usersRepositoryMock } from "../../../../mocks";

jest.mock("../../../../../src/modules/assets/assets.repository", () => ({
  assetsRepository: assetsRepositoryMock,
}));

jest.mock("../../../../../src/modules/users/users.repository", () => ({
  usersRepository: usersRepositoryMock,
}));

jest.mock("../../../../../src/modules/notifications/notifications.service", () => ({
  notificationsService: { createMany: jest.fn() },
}));

jest.mock("../../../../../src/config", () => ({
  env: { ASSET_WARRANTY_LEAD_DAYS: 30 },
  logger: loggerMock,
}));

import { checkWarrantyExpiry } from "../../../../../src/jobs/cron/assets/checkWarrantyExpiry";
import { notificationsService } from "../../../../../src/modules/notifications/notifications.service";

const createManyMock = notificationsService.createMany as jest.MockedFunction<
  typeof notificationsService.createMany
>;

const buildAsset = (overrides: Record<string, unknown> = {}) => ({
  id: "asset-1",
  name: "Rooftop HVAC Unit #1",
  serialNumber: "HVAC-RTU-001",
  warrantyExpiresAt: new Date("2026-11-14T00:00:00.000Z"),
  ...overrides,
});

describe("checkWarrantyExpiry", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should notify every ADMIN/MANAGER and mark the asset reminded", async () => {
    assetsRepositoryMock.findWarrantyExpiring.mockResolvedValue([buildAsset()]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }, { id: "manager-1" }]);
    createManyMock.mockResolvedValue({ created: 2, skipped: 0 });

    await checkWarrantyExpiry();

    expect(assetsRepositoryMock.findWarrantyExpiring).toHaveBeenCalledWith(30);
    expect(usersRepositoryMock.findByRoles).toHaveBeenCalledWith([Role.ADMIN, Role.MANAGER]);
    expect(createManyMock).toHaveBeenCalledWith(NotificationType.WARRANTY_EXPIRING, [
      expect.objectContaining({ userId: "admin-1", relatedEntityId: "asset-1" }),
      expect.objectContaining({ userId: "manager-1", relatedEntityId: "asset-1" }),
    ]);
    expect(assetsRepositoryMock.markWarrantyReminded).toHaveBeenCalledWith(["asset-1"]);
  });

  it("should format the date in UTC regardless of server locale", async () => {
    assetsRepositoryMock.findWarrantyExpiring.mockResolvedValue([buildAsset()]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);
    createManyMock.mockResolvedValue({ created: 1, skipped: 0 });

    await checkWarrantyExpiry();

    expect(createManyMock).toHaveBeenCalledWith(NotificationType.WARRANTY_EXPIRING, [
      expect.objectContaining({
        message: 'Warranty expiring: "Rooftop HVAC Unit #1" is covered until Nov 14, 2026.',
      }),
    ]);
  });

  it("should not mark an asset reminded when every recipient has muted the type", async () => {
    assetsRepositoryMock.findWarrantyExpiring.mockResolvedValue([buildAsset()]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);
    // createMany reports nothing created: all recipients opted out.
    createManyMock.mockResolvedValue({ created: 0, skipped: 1 });

    await checkWarrantyExpiry();

    expect(assetsRepositoryMock.markWarrantyReminded).not.toHaveBeenCalled();
  });

  it("should mark only the assets where someone was actually notified", async () => {
    assetsRepositoryMock.findWarrantyExpiring.mockResolvedValue([
      buildAsset({ id: "asset-1" }),
      buildAsset({ id: "asset-2" }),
    ]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);
    createManyMock
      .mockResolvedValueOnce({ created: 1, skipped: 0 })
      .mockResolvedValueOnce({ created: 0, skipped: 1 });

    await checkWarrantyExpiry();

    expect(assetsRepositoryMock.markWarrantyReminded).toHaveBeenCalledWith(["asset-1"]);
  });

  it("should do nothing when no warranties are expiring", async () => {
    assetsRepositoryMock.findWarrantyExpiring.mockResolvedValue([]);
    usersRepositoryMock.findByRoles.mockResolvedValue([{ id: "admin-1" }]);

    await checkWarrantyExpiry();

    expect(createManyMock).not.toHaveBeenCalled();
    expect(assetsRepositoryMock.markWarrantyReminded).not.toHaveBeenCalled();
  });

  it("should do nothing (and mark nothing) when there are no ADMIN/MANAGER recipients", async () => {
    assetsRepositoryMock.findWarrantyExpiring.mockResolvedValue([buildAsset()]);
    usersRepositoryMock.findByRoles.mockResolvedValue([]);

    await checkWarrantyExpiry();

    expect(createManyMock).not.toHaveBeenCalled();
    expect(assetsRepositoryMock.markWarrantyReminded).not.toHaveBeenCalled();
  });
});
