import { NotificationType } from "../../../../../src/generated/prisma/client";
import { buildTask, loggerMock, tasksRepositoryMock } from "../../../../mocks";

jest.mock("../../../../../src/modules/tasks/tasks.repository", () => ({
  tasksRepository: tasksRepositoryMock,
}));

jest.mock("../../../../../src/modules/notifications/notifications.service", () => ({
  notificationsService: { createMany: jest.fn() },
}));

jest.mock("../../../../../src/config", () => ({
  logger: loggerMock,
}));

import { notificationsService } from "../../../../../src/modules/notifications/notifications.service";
import { checkOverdueTasks } from "../../../../../src/jobs/cron/tasks/checkOverdueTasks";

const createManyMock = notificationsService.createMany as jest.MockedFunction<
  typeof notificationsService.createMany
>;

describe("checkOverdueTasks", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create a TASK_OVERDUE notification for each assigned overdue task", async () => {
    const task = buildTask({ id: "task-1", assignedTo: "user-tech", title: "Replace filter" });

    tasksRepositoryMock.findOverdue.mockResolvedValue([task]);
    createManyMock.mockResolvedValue({ created: 1, skipped: 0 });

    await checkOverdueTasks();

    expect(createManyMock).toHaveBeenCalledWith(NotificationType.TASK_OVERDUE, [
      expect.objectContaining({ userId: "user-tech", relatedEntityId: "task-1" }),
    ]);
  });

  it("should skip overdue tasks with no assignee", async () => {
    const unassignedTask = buildTask({ id: "task-1", assignedTo: null });

    tasksRepositoryMock.findOverdue.mockResolvedValue([unassignedTask]);

    await checkOverdueTasks();

    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("should only notify assigned tasks when overdue tasks are a mix of assigned and unassigned", async () => {
    const assignedTask = buildTask({ id: "task-1", assignedTo: "user-tech" });
    const unassignedTask = buildTask({ id: "task-2", assignedTo: null });

    tasksRepositoryMock.findOverdue.mockResolvedValue([assignedTask, unassignedTask]);
    createManyMock.mockResolvedValue({ created: 1, skipped: 0 });

    await checkOverdueTasks();

    expect(createManyMock).toHaveBeenCalledWith(NotificationType.TASK_OVERDUE, [
      expect.objectContaining({ relatedEntityId: "task-1" }),
    ]);
  });

  it("should do nothing when there are no overdue tasks", async () => {
    tasksRepositoryMock.findOverdue.mockResolvedValue([]);

    await checkOverdueTasks();

    expect(createManyMock).not.toHaveBeenCalled();
  });
});
