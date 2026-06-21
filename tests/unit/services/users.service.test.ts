import { Role } from "../../../src/generated/prisma/client";
import { ForbiddenError, NotFoundError, ConflictError } from "../../../src/errors";

import { buildUser, usersRepositoryMock } from "../../mocks";
import { usersService } from "../../../src/modules/users/users.service";

jest.mock("../../../src/modules/users/users.repository", () => ({
  usersRepository: usersRepositoryMock,
}));

describe("usersService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return the user when they exist", async () => {
      const mockUser = buildUser({ id: "user-1" });

      usersRepositoryMock.findById.mockResolvedValue(mockUser);

      const result = await usersService.findById("user-1");

      expect(result).toEqual(mockUser);
    });

    it("should throw NotFoundError when the user does not exist", async () => {
      usersRepositoryMock.findById.mockResolvedValue(null);

      await expect(usersService.findById("nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateRoles", () => {
    it("should update the roles of an existing user", async () => {
      const mockUser = buildUser({ id: "user-1", roles: [Role.TECHNICIAN] });

      usersRepositoryMock.findById.mockResolvedValue(mockUser);
      usersRepositoryMock.updateRoles.mockResolvedValue({ ...mockUser, roles: [Role.MANAGER] });

      const result = await usersService.updateRoles("user-1", { roles: [Role.MANAGER] });

      expect(result.roles).toEqual([Role.MANAGER]);
      expect(usersRepositoryMock.updateRoles).toHaveBeenCalledWith("user-1", {
        roles: [Role.MANAGER],
      });
    });

    it("should throw NotFoundError when the target user does not exist", async () => {
      usersRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        usersService.updateRoles("nonexistent", { roles: [Role.MANAGER] }),
      ).rejects.toThrow(NotFoundError);

      expect(usersRepositoryMock.updateRoles).not.toHaveBeenCalled();
    });
  });

  it("should allow user to update their own profile", async () => {
    const mockUser = buildUser({ id: "user-1" });

    usersRepositoryMock.findById.mockResolvedValue(mockUser);
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: false, userName: false });
    usersRepositoryMock.update.mockResolvedValue({ ...mockUser, userName: "newname" });

    const result = await usersService.update(
      "user-1",
      { userName: "newname" },
      { id: "user-1", roles: [Role.TECHNICIAN] },
    );

    expect(result.userName).toBe("newname");
  });

  it("should allow an ADMIN to update any user's profile", async () => {
    const mockUser = buildUser({ id: "user-2" });

    usersRepositoryMock.findById.mockResolvedValue(mockUser);
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: false, userName: false });
    usersRepositoryMock.update.mockResolvedValue({ ...mockUser, userName: "updated" });

    const result = await usersService.update(
      "user-2",
      { userName: "updated" },
      { id: "user-admin", roles: [Role.ADMIN] },
    );

    expect(result.userName).toBe("updated");
  });

  it("should throw ForbiddenError when a non-admin tries to update someone else's profile", async () => {
    const mockUser = buildUser({ id: "user-2" });

    usersRepositoryMock.findById.mockResolvedValue(mockUser);

    await expect(
      usersService.update(
        "user-2",
        { userName: "hacked" },
        { id: "user-1", roles: [Role.TECHNICIAN] }, // not user-2, not admin
      ),
    ).rejects.toThrow(ForbiddenError);

    expect(usersRepositoryMock.update).not.toHaveBeenCalled();
  });

  it("should throw ConflictError when email is already taken by another user", async () => {
    const mockUser = buildUser({ id: "user-1", email: "old@example.com" });

    usersRepositoryMock.findById.mockResolvedValue(mockUser);
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: true, userName: false });

    await expect(
      usersService.update(
        "user-1",
        { email: "taken@example.com" },
        { id: "user-1", roles: [Role.TECHNICIAN] },
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("should not check conflicts for fields that are unchanged", async () => {
    const mockUser = buildUser({ id: "user-1", email: "same@example.com", userName: "same" });

    usersRepositoryMock.findById.mockResolvedValue(mockUser);
    usersRepositoryMock.findConflicts.mockResolvedValue({ email: false, userName: false });
    usersRepositoryMock.update.mockResolvedValue(mockUser);

    await usersService.update(
      "user-1",
      { email: "same@example.com" }, // unchanged — should resolve to undefined in the conflict check
      { id: "user-1", roles: [Role.TECHNICIAN] },
    );

    expect(usersRepositoryMock.findConflicts).toHaveBeenCalledWith({
      email: undefined, // unchanged, so not checked
      userName: undefined,
      excludeId: "user-1",
    });
  });

  it("should throw NotFoundError when target user does not exist", async () => {
    usersRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      usersService.update(
        "nonexistent",
        { userName: "x" },
        { id: "user-admin", roles: [Role.ADMIN] },
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("should allow deleting another user", async () => {
    const mockUser = buildUser({ id: "user-2" });

    usersRepositoryMock.findById.mockResolvedValue(mockUser);
    usersRepositoryMock.delete.mockResolvedValue(undefined);

    await usersService.delete("user-2", "user-admin");

    expect(usersRepositoryMock.delete).toHaveBeenCalledWith("user-2");
  });

  it("should throw ForbiddenError when a user tries to delete their own account", async () => {
    await expect(usersService.delete("user-1", "user-1")).rejects.toThrow(ForbiddenError);

    expect(usersRepositoryMock.delete).not.toHaveBeenCalled();
  });

  it("should throw NotFoundError when target user does not exist", async () => {
    usersRepositoryMock.findById.mockResolvedValue(null);

    await expect(usersService.delete("nonexistent", "user-admin")).rejects.toThrow(NotFoundError);
  });
});
