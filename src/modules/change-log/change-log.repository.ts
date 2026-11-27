import type { ChangeLogAction, ChangeLogEntity, Prisma } from "../../generated/prisma/client";
import { currentUser } from "./change-log.context";
import { buildChanges } from "./change-log.utils";

type RecordInput = {
  action: ChangeLogAction;
  entityType: ChangeLogEntity;
  entityId: string;
  // Name when changed; survives rename and delete.
  entityLabel?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export const changeLogRepository = {
  record: async (
    tx: Prisma.TransactionClient,
    { before = null, after = null, ...entry }: RecordInput,
  ): Promise<void> => {
    const changes = buildChanges(entry.entityType, entry.action, before, after);

    if (changes.length === 0) return;

    const user = currentUser();

    await tx.changeLog.create({
      data: { ...entry, changes, userId: user?.id ?? null, actorLabel: user?.userName ?? null },
    });
  },
};
