import { prisma } from "../../config";
import type { DowntimeReason, Prisma } from "../../generated/prisma/client";
import { AssetStatus } from "../../generated/prisma/client";
import { DOWNTIME_SELECT } from "./asset-downtimes.constants";

export const assetDowntimesRepository = {
  findById: (id: string) =>
    prisma.assetDowntime.findUnique({ where: { id }, select: DOWNTIME_SELECT }),

  // Events that overlap [from, to], newest first.
  findOverlapping: (assetId: string, from: Date, to: Date) =>
    prisma.assetDowntime.findMany({
      where: {
        assetId,
        startedAt: { lt: to },
        OR: [{ endedAt: null }, { endedAt: { gt: from } }],
      },
      select: DOWNTIME_SELECT,
      orderBy: { startedAt: "desc" },
    }),

  findOpen: (assetId: string) =>
    prisma.assetDowntime.findFirst({ where: { assetId, endedAt: null }, select: { id: true } }),

  // Events never overlap, so a new one must start at or after the last end.
  findLatestEnd: async (assetId: string): Promise<Date | null> => {
    const { _max } = await prisma.assetDowntime.aggregate({
      where: { assetId },
      _max: { endedAt: true },
    });

    return _max.endedAt;
  },

  // The event and the asset's DOWN status change together.
  start: (data: {
    assetId: string;
    taskId?: string;
    reason: DowntimeReason;
    startedAt: Date;
    note?: string;
    createdBy: string;
  }) =>
    prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id: data.assetId }, data: { status: AssetStatus.DOWN } });

      return tx.assetDowntime.create({ data, select: DOWNTIME_SELECT });
    }),

  end: (id: string, assetId: string, endedAt: Date) =>
    prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id: assetId }, data: { status: AssetStatus.OPERATIONAL } });

      return tx.assetDowntime.update({ where: { id }, data: { endedAt }, select: DOWNTIME_SELECT });
    }),

  // Deleting an ongoing event puts the asset back in service.
  delete: (id: string, assetId: string, wasOpen: boolean) =>
    prisma.$transaction(async (tx) => {
      await tx.assetDowntime.delete({ where: { id } });

      if (wasOpen) {
        await tx.asset.update({
          where: { id: assetId },
          data: { status: AssetStatus.OPERATIONAL },
        });
      }
    }),

  // Keeps events in step when the status is edited directly (PATCH /assets/:id).
  // Going DOWN opens a breakdown unless one is open; leaving DOWN closes it.
  syncWithStatus: async (
    tx: Prisma.TransactionClient,
    assetId: string,
    from: AssetStatus,
    to: AssetStatus,
  ): Promise<void> => {
    if (to === AssetStatus.DOWN && from !== AssetStatus.DOWN) {
      const open = await tx.assetDowntime.findFirst({ where: { assetId, endedAt: null } });

      if (!open) {
        await tx.assetDowntime.create({
          data: { assetId, reason: "BREAKDOWN", startedAt: new Date() },
        });
      }
    }

    if (from === AssetStatus.DOWN && to !== AssetStatus.DOWN) {
      await tx.assetDowntime.updateMany({
        where: { assetId, endedAt: null },
        data: { endedAt: new Date() },
      });
    }
  },
};
