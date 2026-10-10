import { prisma } from "../../config";
import { getSkipValue, getTotalPages, resolveSortField } from "../../utils";
import {
  METER_ENTITY_ALLOWED_SORT_FIELDS,
  METER_ENTITY_DEFAULT_SORT_FIELD,
  METER_READING_SELECT,
  METER_SELECT,
} from "./meters.constants";
import type { CreateMeter, MetersQuery, ReadingsQuery } from "./meters.schemas";

export const metersRepository = {
  findAll: async (query: MetersQuery) => {
    const { page, limit, sortBy, sortOrder, assetId } = query;

    const field = resolveSortField(
      sortBy,
      METER_ENTITY_ALLOWED_SORT_FIELDS,
      METER_ENTITY_DEFAULT_SORT_FIELD,
    );
    const where = assetId ? { assetId } : undefined;

    const [total, data] = await Promise.all([
      prisma.meter.count({ where }),
      prisma.meter.findMany({
        where,
        select: METER_SELECT,
        orderBy: { [field]: sortOrder },
        skip: getSkipValue(page, limit),
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, pages: getTotalPages(total, limit) } };
  },
  findById: (id: string) => prisma.meter.findUnique({ where: { id }, select: METER_SELECT }),
  findByAssetAndName: (assetId: string, name: string) =>
    prisma.meter.findUnique({ where: { assetId_name: { assetId, name } }, select: { id: true } }),
  // The initial reading is logged as reading #1 in the same write, so a meter's
  // currentReading always has a matching entry in its log. Both timestamps come
  // from the database clock (column defaults), so they match.
  create: ({ assetId, name, unit, initialReading }: CreateMeter, recordedBy: string) =>
    prisma.meter.create({
      data: {
        assetId,
        name,
        unit,
        currentReading: initialReading,
        readings: { create: { value: initialReading, recordedBy } },
      },
      select: METER_SELECT,
    }),
  update: (id: string, name: string) =>
    prisma.meter.update({ where: { id }, data: { name }, select: METER_SELECT }),

  delete: async (id: string): Promise<void> => {
    await prisma.meter.delete({ where: { id } });
  },
  // Matches only while the stored reading is <= the new value, so racing readings
  // can't lower it. Returns null if the guard missed (the caller tells 404 from 409).
  // The time is stamped in a separate statement after the lock is won (DB clock), so
  // a reading that waited is stamped after the one it waited behind.
  recordReading: (id: string, value: number, recordedBy: string) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.meter.updateMany({
        where: { id, currentReading: { lte: value } },
        data: { currentReading: value },
      });

      if (count === 0) return null;

      const [{ lastReadingAt }] = await tx.$queryRaw<{ lastReadingAt: Date }[]>`
        UPDATE meters SET "lastReadingAt" = clock_timestamp() AT TIME ZONE 'UTC'
        WHERE id = ${id} RETURNING "lastReadingAt"`;

      const reading = await tx.meterReading.create({
        data: { meterId: id, value, recordedAt: lastReadingAt, recordedBy },
        select: METER_READING_SELECT,
      });
      const meter = await tx.meter.findUniqueOrThrow({ where: { id }, select: METER_SELECT });

      return { reading, meter };
    }),

  findReadings: async (meterId: string, { page, limit }: ReadingsQuery) => {
    const where = { meterId };

    const [total, data] = await Promise.all([
      prisma.meterReading.count({ where }),
      prisma.meterReading.findMany({
        where,
        select: METER_READING_SELECT,
        // Within one millisecond the higher value is the later one (readings only go up).
        orderBy: [{ recordedAt: "desc" }, { value: "desc" }, { id: "desc" }],
        skip: getSkipValue(page, limit),
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, pages: getTotalPages(total, limit) } };
  },
};
