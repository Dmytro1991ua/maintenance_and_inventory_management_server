import { Prisma } from "../../generated/prisma/client";

// A Postgres INTEGER column's ceiling.
export const MAX_METER_READING = 2_147_483_647;

export const METER_SELECT = {
  id: true,
  assetId: true,
  name: true,
  unit: true,
  currentReading: true,
  lastReadingAt: true,
  createdAt: true,
  updatedAt: true,
  asset: { select: { id: true, name: true, serialNumber: true } },
} satisfies Prisma.MeterSelect;

export const METER_READING_SELECT = {
  id: true,
  meterId: true,
  value: true,
  recordedAt: true,
  recorder: { select: { id: true, userName: true } },
} satisfies Prisma.MeterReadingSelect;

export const METER_ENTITY_ALLOWED_SORT_FIELDS = ["name", "lastReadingAt", "createdAt"] as const;

export const METER_ENTITY_DEFAULT_SORT_FIELD = "createdAt" as const;

export const METER_NOT_FOUND_MESSAGE = "Meter not found";

export const METER_NAME_EXISTS_MESSAGE = "This asset already has a meter with that name";

export const buildReadingBelowCurrentMessage = (currentReading: number): string =>
  `Reading cannot be lower than the current reading (${currentReading})`;
