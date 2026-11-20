import { BadRequestError, ConflictError, NotFoundError } from "../../errors";
import { AssetStatus } from "../../generated/prisma/client";
import { addDays, findOrThrow } from "../../utils";
import { ASSET_NOT_FOUND_MESSAGE } from "../assets/assets.constants";
import { assetsRepository } from "../assets/assets.repository";
import { tasksRepository } from "../tasks/tasks.repository";
import {
  DEFAULT_SUMMARY_DAYS,
  DOWNTIME_ALREADY_ENDED_MESSAGE,
  DOWNTIME_ALREADY_OPEN_MESSAGE,
  DOWNTIME_END_BEFORE_START_MESSAGE,
  DOWNTIME_FUTURE_MESSAGE,
  DOWNTIME_NOT_FOUND_MESSAGE,
  DOWNTIME_OVERLAP_MESSAGE,
  DOWNTIME_RETIRED_MESSAGE,
  DOWNTIME_TASK_MISMATCH_MESSAGE,
} from "./asset-downtimes.constants";
import { assetDowntimesRepository } from "./asset-downtimes.repository";
import type { DowntimeQuery, EndDowntime, StartDowntime } from "./asset-downtimes.schemas";
import { mapDowntime, summarizeDowntime } from "./asset-downtimes.utils";

const findAsset = (assetId: string) =>
  findOrThrow(() => assetsRepository.findById(assetId), ASSET_NOT_FOUND_MESSAGE);

// 404 rather than 403 for a mismatched pair, so event ids on other assets can't be probed.
const findEvent = async (assetId: string, downtimeId: string) => {
  const event = await findOrThrow(
    () => assetDowntimesRepository.findById(downtimeId),
    DOWNTIME_NOT_FOUND_MESSAGE,
  );

  if (event.assetId !== assetId) throw new NotFoundError(DOWNTIME_NOT_FOUND_MESSAGE);

  return event;
};

// An explicit time can be backdated but never set in the future.
const resolveTime = (value: string | undefined, now: Date): Date => {
  const time = value ? new Date(value) : now;

  if (time > now) throw new BadRequestError(DOWNTIME_FUTURE_MESSAGE);

  return time;
};

export const assetDowntimesService = {
  findAll: async (assetId: string, query: DowntimeQuery) => {
    await findAsset(assetId);

    const now = new Date();
    const to = query.to ?? now;
    const from = query.from ?? addDays(to, -DEFAULT_SUMMARY_DAYS);

    if (from > to) throw new BadRequestError("`from` must be on or before `to`");

    const events = await assetDowntimesRepository.findOverlapping(assetId, from, to);

    return {
      from,
      to,
      summary: summarizeDowntime(events, from, to, now),
      events: events.map((e) => mapDowntime(e, now)),
    };
  },

  start: async (assetId: string, userId: string, data: StartDowntime) => {
    const asset = await findAsset(assetId);

    if (asset.status === AssetStatus.RETIRED) throw new ConflictError(DOWNTIME_RETIRED_MESSAGE);

    if (await assetDowntimesRepository.findOpen(assetId)) {
      throw new ConflictError(DOWNTIME_ALREADY_OPEN_MESSAGE);
    }

    const now = new Date();
    const startedAt = resolveTime(data.startedAt, now);
    const latestEnd = await assetDowntimesRepository.findLatestEnd(assetId);

    if (latestEnd && startedAt < latestEnd) throw new ConflictError(DOWNTIME_OVERLAP_MESSAGE);

    if (data.taskId) {
      const task = await findOrThrow(
        () => tasksRepository.findById(data.taskId!),
        "Task not found",
      );

      if (task.assetId !== assetId) throw new BadRequestError(DOWNTIME_TASK_MISMATCH_MESSAGE);
    }

    const event = await assetDowntimesRepository.start({
      assetId,
      taskId: data.taskId,
      reason: data.reason,
      startedAt,
      note: data.note,
      createdBy: userId,
    });

    return mapDowntime(event, now);
  },

  end: async (assetId: string, downtimeId: string, data: EndDowntime) => {
    const event = await findEvent(assetId, downtimeId);

    if (event.endedAt) throw new ConflictError(DOWNTIME_ALREADY_ENDED_MESSAGE);

    const now = new Date();
    const endedAt = resolveTime(data.endedAt, now);

    if (endedAt <= event.startedAt) throw new BadRequestError(DOWNTIME_END_BEFORE_START_MESSAGE);

    const ended = await assetDowntimesRepository.end(downtimeId, assetId, endedAt);

    return mapDowntime(ended, now);
  },

  delete: async (assetId: string, downtimeId: string): Promise<void> => {
    const event = await findEvent(assetId, downtimeId);

    await assetDowntimesRepository.delete(downtimeId, assetId, event.endedAt === null);
  },
};
