import { prisma } from "../../config";
import type { ChangeLogAction, DowntimeReason, Prisma } from "../../generated/prisma/client";
import { AssetStatus } from "../../generated/prisma/client";
import { changeLogRepository } from "../change-log/change-log.repository";
import { DOWNTIME_SELECT } from "./asset-downtimes.constants";

type AssetRef = { id: string; name: string; status: AssetStatus };
type Row = Record<string, unknown>;

const findAssetRef = (tx: Prisma.TransactionClient, id: string) =>
  tx.asset.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, status: true } });

const recordDowntime = (
  tx: Prisma.TransactionClient,
  action: ChangeLogAction,
  assetName: string,
  id: string,
  rows: { before?: Row; after?: Row },
) =>
  changeLogRepository.record(tx, {
    action,
    entityType: "ASSET_DOWNTIME",
    entityId: id,
    entityLabel: assetName,
    ...rows,
  });

// Moves the asset only from the given statuses, so a retired asset is never revived.
const moveAssetStatus = async (
  tx: Prisma.TransactionClient,
  asset: AssetRef,
  from: AssetStatus[],
  to: AssetStatus,
): Promise<boolean> => {
  const { count } = await tx.asset.updateMany({
    where: { id: asset.id, status: { in: from } },
    data: { status: to },
  });

  if (count === 0) return false;

  await changeLogRepository.record(tx, {
    action: "UPDATE",
    entityType: "ASSET",
    entityId: asset.id,
    entityLabel: asset.name,
    before: { status: asset.status },
    after: { status: to },
  });

  return true;
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
      const asset = await findAssetRef(tx, data.assetId);
      const moved = await moveAssetStatus(
        tx,
        asset,
        [AssetStatus.OPERATIONAL, AssetStatus.DOWN],
        AssetStatus.DOWN,
      );

      if (!moved) return null;

      const event = await tx.assetDowntime.create({ data, select: DOWNTIME_SELECT });

      await recordDowntime(tx, "CREATE", asset.name, event.id, { after: event });

      return event;
    }),

  // Null: the event was already ended. Matching on `endedAt: null` keeps a stale or repeated
  // end from rewriting a finished event or reviving an asset.
  end: (id: string, assetId: string, endedAt: Date) =>
    prisma.$transaction(async (tx) => {
      const asset = await findAssetRef(tx, assetId);
      const { count } = await tx.assetDowntime.updateMany({
        where: { id, endedAt: null },
        data: { endedAt },
      });

      if (count === 0) return null;

      await recordDowntime(tx, "UPDATE", asset.name, id, {
        before: { endedAt: null },
        after: { endedAt },
      });
      await moveAssetStatus(tx, asset, [AssetStatus.DOWN], AssetStatus.OPERATIONAL);

      return tx.assetDowntime.findUniqueOrThrow({ where: { id }, select: DOWNTIME_SELECT });
    }),

  // Deleting an ongoing event puts the asset back in service. Whether it was ongoing comes
  // from the deleted row itself, so it cannot go stale.
  delete: (id: string, assetId: string) =>
    prisma.$transaction(async (tx) => {
      const asset = await findAssetRef(tx, assetId);
      const deleted = await tx.assetDowntime.delete({ where: { id } });

      await recordDowntime(tx, "DELETE", asset.name, id, { before: deleted });

      if (deleted.endedAt === null) {
        await moveAssetStatus(tx, asset, [AssetStatus.DOWN], AssetStatus.OPERATIONAL);
      }
    }),

  // Keeps events in step when the status is edited directly (PATCH /assets/:id).
  // Going DOWN opens a breakdown unless one is open; leaving DOWN closes it.
  syncWithStatus: async (
    tx: Prisma.TransactionClient,
    asset: { id: string; name: string },
    from: AssetStatus,
    to: AssetStatus,
  ): Promise<void> => {
    const open = await tx.assetDowntime.findFirst({ where: { assetId: asset.id, endedAt: null } });

    if (to === AssetStatus.DOWN && from !== AssetStatus.DOWN && !open) {
      const event = await tx.assetDowntime.create({
        data: { assetId: asset.id, reason: "BREAKDOWN", startedAt: new Date() },
      });

      await recordDowntime(tx, "CREATE", asset.name, event.id, { after: event });
    }

    if (from === AssetStatus.DOWN && to !== AssetStatus.DOWN && open) {
      const endedAt = new Date();
      const { count } = await tx.assetDowntime.updateMany({
        where: { id: open.id, endedAt: null },
        data: { endedAt },
      });

      if (count > 0) {
        await recordDowntime(tx, "UPDATE", asset.name, open.id, {
          before: { endedAt: null },
          after: { endedAt },
        });
      }
    }
  },
};
