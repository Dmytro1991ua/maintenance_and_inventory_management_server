import { ConflictError } from "../../errors";
import { findOrThrow } from "../../utils";
import { usersRepository } from "../users/users.repository";
import { RECURRING_TASK_NOT_FOUND_MESSAGE } from "./recurring-tasks.constants";
import { recurringTasksRepository } from "./recurring-tasks.repository";
import type {
  CreateRecurringTask,
  RecurringTasksQuery,
  UpdateRecurringTask,
} from "./recurring-tasks.schemas";

export const recurringTasksService = {
  findAll: async (query: RecurringTasksQuery) => recurringTasksRepository.findAll(query),
  findById: async (id: string) =>
    findOrThrow(() => recurringTasksRepository.findById(id), RECURRING_TASK_NOT_FOUND_MESSAGE),
  create: async (data: CreateRecurringTask, createdBy: string) => {
    if (data.assignedTo) {
      await findOrThrow(() => usersRepository.findById(data.assignedTo!), "Assignee not found");
    }

    return recurringTasksRepository.create({ ...data, createdBy });
  },
  update: async (id: string, data: UpdateRecurringTask) => {
    await findOrThrow(
      () => recurringTasksRepository.findById(id),
      RECURRING_TASK_NOT_FOUND_MESSAGE,
    );

    if (data.assignedTo) {
      await findOrThrow(() => usersRepository.findById(data.assignedTo!), "Assignee not found");
    }

    return recurringTasksRepository.update(id, data);
  },
  pause: async (id: string) => {
    const schedule = await findOrThrow(
      () => recurringTasksRepository.findById(id),
      RECURRING_TASK_NOT_FOUND_MESSAGE,
    );

    if (!schedule.isActive) {
      throw new ConflictError("Schedule is already paused");
    }

    return recurringTasksRepository.setActive(id, false);
  },
  resume: async (id: string) => {
    const schedule = await findOrThrow(
      () => recurringTasksRepository.findById(id),
      RECURRING_TASK_NOT_FOUND_MESSAGE,
    );

    if (schedule.isActive) {
      throw new ConflictError("Schedule is already active");
    }

    return recurringTasksRepository.setActive(id, true);
  },
  delete: async (id: string): Promise<void> => {
    await findOrThrow(
      () => recurringTasksRepository.findById(id),
      RECURRING_TASK_NOT_FOUND_MESSAGE,
    );

    await recurringTasksRepository.delete(id);
  },
};
