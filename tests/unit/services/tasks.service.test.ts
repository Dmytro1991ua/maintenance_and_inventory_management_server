import { Role } from "../../../src/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "../../../src/errors";
import { buildTask, buildUser, tasksRepositoryMock, usersRepositoryMock } from "../../mocks";
import { tasksService } from "../../../src/modules/tasks/tasks.service";

jest.mock("../../../src/modules/tasks/tasks.repository", () => ({
  tasksRepository: tasksRepositoryMock,
}));

jest.mock("../../../src/modules/users/users.repository", () => ({
  usersRepository: usersRepositoryMock,
}));

describe("tasksService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return the task when it exists", async () => {
      const mockTask = buildTask();

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);

      const result = await tasksService.findById(mockTask.id);

      expect(result).toEqual(mockTask);
    });

    it("should throw NotFoundError when the task does not exist", async () => {
      tasksRepositoryMock.findById.mockResolvedValue(null);

      await expect(tasksService.findById("nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    it("should create the task when no assignee is given", async () => {
      const mockTask = buildTask({ assignedTo: null });

      tasksRepositoryMock.create.mockResolvedValue(mockTask);

      const result = await tasksService.create({ title: "Replace HVAC filter" });

      expect(result).toEqual(mockTask);
      expect(usersRepositoryMock.findById).not.toHaveBeenCalled();
    });

    it("should create the task when the assignee exists", async () => {
      const mockTask = buildTask({ assignedTo: "user-tech" });

      usersRepositoryMock.findById.mockResolvedValue(buildUser({ id: "user-tech" }));
      tasksRepositoryMock.create.mockResolvedValue(mockTask);

      const result = await tasksService.create({
        title: "Replace HVAC filter",
        assignedTo: "user-tech",
      });

      expect(result).toEqual(mockTask);
    });

    it("should throw NotFoundError when the assignee does not exist", async () => {
      usersRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        tasksService.create({ title: "Replace HVAC filter", assignedTo: "nonexistent-user" }),
      ).rejects.toThrow(NotFoundError);

      expect(tasksRepositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete the task when it exists", async () => {
      const mockTask = buildTask();

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);
      tasksRepositoryMock.delete.mockResolvedValue(undefined);

      await tasksService.delete(mockTask.id);

      expect(tasksRepositoryMock.delete).toHaveBeenCalledWith(mockTask.id);
    });

    it("should throw NotFoundError when the task does not exist", async () => {
      tasksRepositoryMock.findById.mockResolvedValue(null);

      await expect(tasksService.delete("nonexistent")).rejects.toThrow(NotFoundError);

      expect(tasksRepositoryMock.delete).not.toHaveBeenCalled();
    });
  });

  describe("requesting user is ADMIN", () => {
    it("should allow updating any field, regardless of task assignment", async () => {
      const mockTask = buildTask({ assignedTo: "someone-else" });

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);
      tasksRepositoryMock.update.mockResolvedValue({ ...mockTask, title: "New title" });

      const result = await tasksService.update(
        mockTask.id,
        { title: "New title" },
        { id: "user-admin", roles: [Role.ADMIN] },
      );

      expect(result.title).toBe("New title");
      expect(tasksRepositoryMock.update).toHaveBeenCalledWith(mockTask.id, { title: "New title" });
    });

    it("should allow reassigning to a user that exists", async () => {
      const mockTask = buildTask();

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);
      usersRepositoryMock.findById.mockResolvedValue(buildUser({ id: "new-assignee" }));
      tasksRepositoryMock.update.mockResolvedValue({ ...mockTask, assignedTo: "new-assignee" });

      const result = await tasksService.update(
        mockTask.id,
        { assignedTo: "new-assignee" },
        { id: "user-admin", roles: [Role.ADMIN] },
      );

      expect(result.assignedTo).toBe("new-assignee");
    });

    it("should throw NotFoundError when reassigning to a user that does not exist", async () => {
      const mockTask = buildTask();

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);
      usersRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        tasksService.update(
          mockTask.id,
          { assignedTo: "nonexistent-user" },
          { id: "user-admin", roles: [Role.ADMIN] },
        ),
      ).rejects.toThrow(NotFoundError);

      expect(tasksRepositoryMock.update).not.toHaveBeenCalled();
    });
  });

  describe("requesting user is MANAGER", () => {
    it("should allow updating any field, regardless of task assignment", async () => {
      const mockTask = buildTask({ assignedTo: "someone-else" });

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);
      tasksRepositoryMock.update.mockResolvedValue({ ...mockTask, status: "DONE" });

      const result = await tasksService.update(
        mockTask.id,
        { status: "DONE" },
        { id: "user-manager", roles: [Role.MANAGER] },
      );

      expect(result.status).toBe("DONE");
    });
  });

  describe("requesting user is TECHNICIAN", () => {
    it("should allow updating status on a task assigned to them", async () => {
      const mockTask = buildTask({ assignedTo: "user-tech" });

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);
      tasksRepositoryMock.update.mockResolvedValue({ ...mockTask, status: "IN_PROGRESS" });

      const result = await tasksService.update(
        mockTask.id,
        { status: "IN_PROGRESS" },
        { id: "user-tech", roles: [Role.TECHNICIAN] },
      );

      expect(result.status).toBe("IN_PROGRESS");
    });

    it("should throw ForbiddenError when updating a task NOT assigned to them", async () => {
      const mockTask = buildTask({ assignedTo: "user-tech" });

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);

      await expect(
        tasksService.update(
          mockTask.id,
          { status: "DONE" },
          { id: "different-tech", roles: [Role.TECHNICIAN] },
        ),
      ).rejects.toThrow(ForbiddenError);

      expect(tasksRepositoryMock.update).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenError when sending fields other than status", async () => {
      const mockTask = buildTask({ assignedTo: "user-tech" });

      tasksRepositoryMock.findById.mockResolvedValue(mockTask);

      await expect(
        tasksService.update(
          mockTask.id,
          { title: "Trying to change title", status: "DONE" },
          { id: "user-tech", roles: [Role.TECHNICIAN] },
        ),
      ).rejects.toThrow(ForbiddenError);

      expect(tasksRepositoryMock.update).not.toHaveBeenCalled();
    });
  });

  describe("task does not exist", () => {
    it("should throw NotFoundError before checking permissions", async () => {
      tasksRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        tasksService.update(
          "nonexistent-task",
          { status: "DONE" },
          { id: "user-admin", roles: [Role.ADMIN] },
        ),
      ).rejects.toThrow(NotFoundError);

      expect(tasksRepositoryMock.update).not.toHaveBeenCalled();
    });
  });
});
