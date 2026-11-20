import { Prisma } from "../../generated/prisma/client";

export const DEFAULT_SUMMARY_DAYS = 365;

export const DOWNTIME_NOT_FOUND_MESSAGE = "Downtime event not found";
export const DOWNTIME_ALREADY_OPEN_MESSAGE = "This asset is already down";
export const DOWNTIME_ALREADY_ENDED_MESSAGE = "This downtime has already ended";
export const DOWNTIME_RETIRED_MESSAGE = "A retired asset cannot go down";
export const DOWNTIME_FUTURE_MESSAGE = "Time cannot be in the future";
export const DOWNTIME_OVERLAP_MESSAGE =
  "Downtime cannot start before the asset's previous downtime ended";
export const DOWNTIME_END_BEFORE_START_MESSAGE = "End must be after the start";
export const DOWNTIME_TASK_MISMATCH_MESSAGE = "The task does not belong to this asset";

export const DOWNTIME_SELECT = {
  id: true,
  assetId: true,
  taskId: true,
  reason: true,
  startedAt: true,
  endedAt: true,
  note: true,
  createdAt: true,
  creator: { select: { id: true, userName: true } },
} satisfies Prisma.AssetDowntimeSelect;
