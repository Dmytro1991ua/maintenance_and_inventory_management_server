import { NotificationType } from "../../../../../src/generated/prisma/client";
import { loggerMock, tasksRepositoryMock, usersRepositoryMock } from "../../../../mocks";

jest.mock("../../../../../src/modules/tasks/tasks.repository", () => ({
  tasksRepository: tasksRepositoryMock,
}));

jest.mock("../../../../../src/modules/users/users.repository", () => ({
  usersRepository: usersRepositoryMock,
}));

jest.mock("../../../../../src/modules/notifications/notifications.service", () => ({
  notificationsService: { createMany: jest.fn() },
}));

jest.mock("../../../../../src/shared/email.service", () => ({
  emailService: { sendTaskDueReminder: jest.fn() },
}));

jest.mock("../../../../../src/config", () => ({
  env: { TASK_REMINDER_LEAD_DAYS: 3 },
  logger: loggerMock,
}));

import { notificationsService } from "../../../../../src/modules/notifications/notifications.service";
import { emailService } from "../../../../../src/shared/email.service";
import { checkDueSoonTasks } from "../../../../../src/jobs/cron/tasks/checkDueSoonTasks";

const createManyMock = notificationsService.createMany as jest.MockedFunction<
  typeof notificationsService.createMany
>;
const sendReminderMock = emailService.sendTaskDueReminder as jest.MockedFunction<
  typeof emailService.sendTaskDueReminder
>;

const buildDueSoonTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Replace filter",
  dueDate: new Date("2026-09-15T00:00:00.000Z"),
  assignedTo: "user-tech",
  assignee: { id: "user-tech", userName: "tech", email: "tech@example.com" },
  ...overrides,
});

describe("checkDueSoonTasks", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should notify and email the assignee, then mark the task reminded", async () => {
    tasksRepositoryMock.findDueSoon.mockResolvedValue([buildDueSoonTask()]);
    usersRepositoryMock.findPreferencesByIds.mockResolvedValue([
      { id: "user-tech", notificationPreferences: {} },
    ]);
    createManyMock.mockResolvedValue({ created: 1, skipped: 0 });
    sendReminderMock.mockResolvedValue(undefined);

    await checkDueSoonTasks();

    expect(createManyMock).toHaveBeenCalledWith(NotificationType.TASK_DUE_SOON, [
      expect.objectContaining({ userId: "user-tech", relatedEntityId: "task-1" }),
    ]);
    expect(sendReminderMock).toHaveBeenCalledWith(
      "tech@example.com",
      expect.objectContaining({ id: "task-1", title: "Replace filter" }),
    );
    expect(tasksRepositoryMock.markReminded).toHaveBeenCalledWith(["task-1"]);
  });

  it("should skip an assignee who opted out of TASK_DUE_SOON (both channels)", async () => {
    tasksRepositoryMock.findDueSoon.mockResolvedValue([buildDueSoonTask()]);
    usersRepositoryMock.findPreferencesByIds.mockResolvedValue([
      { id: "user-tech", notificationPreferences: { TASK_DUE_SOON: false } },
    ]);

    await checkDueSoonTasks();

    expect(createManyMock).not.toHaveBeenCalled();
    expect(sendReminderMock).not.toHaveBeenCalled();
    expect(tasksRepositoryMock.markReminded).not.toHaveBeenCalled();
  });

  it("should remind only the eligible assignee in a mixed batch", async () => {
    tasksRepositoryMock.findDueSoon.mockResolvedValue([
      buildDueSoonTask({
        id: "task-1",
        assignedTo: "user-a",
        assignee: { id: "user-a", userName: "a", email: "a@example.com" },
      }),
      buildDueSoonTask({
        id: "task-2",
        assignedTo: "user-b",
        assignee: { id: "user-b", userName: "b", email: "b@example.com" },
      }),
    ]);
    usersRepositoryMock.findPreferencesByIds.mockResolvedValue([
      { id: "user-a", notificationPreferences: {} },
      { id: "user-b", notificationPreferences: { TASK_DUE_SOON: false } },
    ]);
    createManyMock.mockResolvedValue({ created: 1, skipped: 0 });
    sendReminderMock.mockResolvedValue(undefined);

    await checkDueSoonTasks();

    expect(createManyMock).toHaveBeenCalledWith(NotificationType.TASK_DUE_SOON, [
      expect.objectContaining({ userId: "user-a", relatedEntityId: "task-1" }),
    ]);
    expect(sendReminderMock).toHaveBeenCalledTimes(1);
    expect(tasksRepositoryMock.markReminded).toHaveBeenCalledWith(["task-1"]);
  });

  it("should still mark the task reminded when the email send fails", async () => {
    tasksRepositoryMock.findDueSoon.mockResolvedValue([buildDueSoonTask()]);
    usersRepositoryMock.findPreferencesByIds.mockResolvedValue([
      { id: "user-tech", notificationPreferences: {} },
    ]);
    createManyMock.mockResolvedValue({ created: 1, skipped: 0 });
    sendReminderMock.mockRejectedValue(new Error("provider down"));

    await checkDueSoonTasks();

    expect(tasksRepositoryMock.markReminded).toHaveBeenCalledWith(["task-1"]);
  });

  it("should do nothing when no tasks are due soon", async () => {
    tasksRepositoryMock.findDueSoon.mockResolvedValue([]);

    await checkDueSoonTasks();

    expect(createManyMock).not.toHaveBeenCalled();
    expect(sendReminderMock).not.toHaveBeenCalled();
    expect(tasksRepositoryMock.markReminded).not.toHaveBeenCalled();
  });
});
