import { BadRequestError, ConflictError } from "../../errors";
import { findOrThrow } from "../../utils";
import { ASSET_NOT_FOUND_MESSAGE } from "../assets/assets.constants";
import { assetsRepository } from "../assets/assets.repository";
import { MAX_METER_READING, METER_NOT_FOUND_MESSAGE } from "../meters/meters.constants";
import { metersRepository } from "../meters/meters.repository";
import { usersRepository } from "../users/users.repository";
import {
  METER_SCHEDULE_FIXED_MESSAGE,
  RECURRING_TASK_NOT_FOUND_MESSAGE,
} from "./recurring-tasks.constants";
import { recurringTasksRepository } from "./recurring-tasks.repository";
import {
  type CreateRecurringTask,
  isMeterSchedule,
  type RecurringTasksQuery,
  type UpdateRecurringTask,
} from "./recurring-tasks.schemas";

const assertAssetExists = (assetId: string) =>
  findOrThrow(() => assetsRepository.findById(assetId), ASSET_NOT_FOUND_MESSAGE);

export const recurringTasksService = {
  findAll: async (query: RecurringTasksQuery) => recurringTasksRepository.findAll(query),
  findById: async (id: string) =>
    findOrThrow(() => recurringTasksRepository.findById(id), RECURRING_TASK_NOT_FOUND_MESSAGE),
  create: async (data: CreateRecurringTask, createdBy: string) => {
    if (data.assignedTo) {
      await findOrThrow(() => usersRepository.findById(data.assignedTo!), "Assignee not found");
    }

    if (isMeterSchedule(data)) {
      const meter = await findOrThrow(
        () => metersRepository.findById(data.meterId),
        METER_NOT_FOUND_MESSAGE,
      );
      // Defaults to one interval ahead, so a new schedule doesn't fire immediately.
      const firstDueReading = data.firstDueReading ?? meter.currentReading + data.intervalReading;

      if (firstDueReading > MAX_METER_READING) {
        throw new BadRequestError("The first due reading is beyond the largest meter reading");
      }

      // The asset always comes from the meter, so the two can't disagree.
      return recurringTasksRepository.createMeterBased({
        ...data,
        firstDueReading,
        assetId: meter.assetId,
        createdBy,
      });
    }

    if (data.assetId) await assertAssetExists(data.assetId);

    return recurringTasksRepository.create({ ...data, createdBy });
  },
  update: async (id: string, data: UpdateRecurringTask) => {
    const schedule = await findOrThrow(
      () => recurringTasksRepository.findById(id),
      RECURRING_TASK_NOT_FOUND_MESSAGE,
    );

    const changesFixedFields =
      schedule.triggerType === "METER" &&
      (data.intervalDays !== undefined || data.assetId !== undefined);

    if (changesFixedFields) {
      throw new BadRequestError(METER_SCHEDULE_FIXED_MESSAGE);
    }

    if (data.assignedTo) {
      await findOrThrow(() => usersRepository.findById(data.assignedTo!), "Assignee not found");
    }

    if (data.assetId) await assertAssetExists(data.assetId);

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
