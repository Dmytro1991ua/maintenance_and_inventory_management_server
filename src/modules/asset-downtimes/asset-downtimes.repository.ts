import { prisma } from "../../config";
import type { DowntimeReason, Prisma } from "../../generated/prisma/client";
import { AssetStatus } from "../../generated/prisma/client";
import { DOWNTIME_SELECT } from "./asset-downtimes.constants";

// Moves the asset only from the given statuses, so a retired asset is never revived.
const moveAssetStatus = async (
  tx: Prisma.TransactionClient,
  assetId: string,
  from: AssetStatus[],
  to: AssetStatus,
): Promise<boolean> => {
  const { count } = await tx.asset.updateMany({
    where: { id: assetId, status: { in: from } },
    data: { status: to },
  });

  return count > 0;
};

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

  // The event and the asset's DOWN status change together. Null: the asset is retired.
  start: (data: {
    assetId: string;
    taskId?: string;
    reason: DowntimeReason;
    startedAt: Date;
    note?: string;
    createdBy: string;
  }) =>
    prisma.$transaction(async (tx) => {
      const moved = await moveAssetStatus(
        tx,
        data.assetId,
        [AssetStatus.OPERATIONAL, AssetStatus.DOWN],
        AssetStatus.DOWN,
      );

      return moved ? tx.assetDowntime.create({ data, select: DOWNTIME_SELECT }) : null;
    }),

  // Null: the event was already ended. Matching on `endedAt: null` keeps a stale or repeated
  // end from rewriting a finished event or reviving an asset.
  end: (id: string, assetId: string, endedAt: Date) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.assetDowntime.updateMany({
        where: { id, endedAt: null },
        data: { endedAt },
      });

      if (count === 0) return null;

      await moveAssetStatus(tx, assetId, [AssetStatus.DOWN], AssetStatus.OPERATIONAL);

      return tx.assetDowntime.findUniqueOrThrow({ where: { id }, select: DOWNTIME_SELECT });
    }),

  // Deleting an ongoing event puts the asset back in service. Whether it was ongoing comes
  // from the deleted row itself, so it cannot go stale.
  delete: (id: string, assetId: string) =>
    prisma.$transaction(async (tx) => {
      const deleted = await tx.assetDowntime.delete({ where: { id } });

      if (deleted.endedAt === null) {
        await moveAssetStatus(tx, assetId, [AssetStatus.DOWN], AssetStatus.OPERATIONAL);
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
