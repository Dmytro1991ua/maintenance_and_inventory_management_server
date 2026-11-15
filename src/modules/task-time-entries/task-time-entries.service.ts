import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { Role, TaskStatus } from "../../generated/prisma/client";
import { addDays, findOrThrow, startOfUtcDay } from "../../utils";
import { isAdminOrManager } from "../../utils/roles";
import { tasksRepository } from "../tasks/tasks.repository";
import { usersRepository } from "../users/users.repository";
import {
  TIME_ENTRY_CANCELLED_TASK_MESSAGE,
  TIME_ENTRY_FUTURE_DATE_MESSAGE,
  TIME_ENTRY_NOT_ASSIGNEE_MESSAGE,
  TIME_ENTRY_NOT_FOUND_MESSAGE,
  TIME_ENTRY_NOT_OWNER_MESSAGE,
} from "./task-time-entries.constants";
import { taskTimeEntriesRepository } from "./task-time-entries.repository";
import type { CreateTimeEntry } from "./task-time-entries.schemas";
import { mapTimeEntry, summarizeTimeEntries } from "./task-time-entries.utils";

type Requester = { id: string; roles: Role[] };

const findTask = (taskId: string) =>
  findOrThrow(() => tasksRepository.findById(taskId), "Task not found");

const parseWorkedOn = (workedOn: string | undefined): Date => {
  const today = startOfUtcDay(new Date());
  const date = workedOn ? new Date(workedOn) : today;
  // One day of slack: a user ahead of UTC can already be on "tomorrow".
  const latest = addDays(today, 1);

  if (date > latest) throw new BadRequestError(TIME_ENTRY_FUTURE_DATE_MESSAGE);

  return date;
};

export const taskTimeEntriesService = {
  findAllByTaskId: async (taskId: string, requester: Requester) => {
    await findTask(taskId);

    const entries = await taskTimeEntriesRepository.findAllByTaskId(taskId);

    return summarizeTimeEntries(entries, isAdminOrManager(requester.roles));
  },

  create: async (taskId: string, requester: Requester, data: CreateTimeEntry) => {
    const task = await findTask(taskId);

    if (task.status === TaskStatus.CANCELLED) {
      throw new ConflictError(TIME_ENTRY_CANCELLED_TASK_MESSAGE);
    }

    const elevated = isAdminOrManager(requester.roles);

    // Technicians log time only on their own tasks.
    if (!elevated && task.assignedTo !== requester.id) {
      throw new ForbiddenError(TIME_ENTRY_NOT_ASSIGNEE_MESSAGE);
    }

    const workedOn = parseWorkedOn(data.workedOn);
    const hourlyRate = await usersRepository.findHourlyRate(requester.id);

    const entry = await taskTimeEntriesRepository.create({
      taskId,
      userId: requester.id,
      minutes: data.minutes,
      workedOn,
      note: data.note,
      hourlyRate,
    });

    return mapTimeEntry(entry, elevated);
  },

  delete: async (taskId: string, entryId: string, requester: Requester): Promise<void> => {
    const entry = await findOrThrow(
      () => taskTimeEntriesRepository.findById(entryId),
      TIME_ENTRY_NOT_FOUND_MESSAGE,
    );

    // 404 rather than 403, so a mismatched pair can't probe entry ids on other tasks.
    if (entry.taskId !== taskId) throw new NotFoundError(TIME_ENTRY_NOT_FOUND_MESSAGE);

    if (!isAdminOrManager(requester.roles) && entry.user?.id !== requester.id) {
      throw new ForbiddenError(TIME_ENTRY_NOT_OWNER_MESSAGE);
    }

    await taskTimeEntriesRepository.delete(entryId);
  },
};
