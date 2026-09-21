import { logger } from "../../../config";
import { NotificationType, Role } from "../../../generated/prisma/client";
import { notificationsService } from "../../../modules/notifications/notifications.service";
import {
  type ItemNeedingReorder,
  reordersRepository,
} from "../../../modules/reorders/reorders.repository";
import {
  buildReorderRaisedMessage,
  isUniqueConstraintError,
  resolveReorderQuantity,
} from "../../../modules/reorders/reorders.utils";
import { usersRepository } from "../../../modules/users/users.repository";

type Recipient = { id: string };

// Inserts a PENDING reorder, returning it — or null when the item already has
// an open reorder (the partial unique index rejects the second insert with a
// P2002). Any other error is a real failure and propagates.
const raiseReorder = async (item: ItemNeedingReorder, quantity: number) => {
  try {
    return await reordersRepository.raise({ inventoryItemId: item.id, quantity, raisedBy: null });
  } catch (err) {
    if (isUniqueConstraintError(err)) return null;

    throw err;
  }
};

const notifyReorderRaised = (
  item: ItemNeedingReorder,
  reorderId: string,
  quantity: number,
  recipients: Recipient[],
): Promise<unknown> => {
  const type = NotificationType.REORDER_RAISED;

  return notificationsService.createMany(
    type,
    recipients.map(({ id }) => ({
      type,
      message: buildReorderRaisedMessage(item.name, item.quantity, quantity),
      userId: id,
      relatedEntityId: reorderId,
    })),
  );
};

/**
 * Auto-raises reorders for inventory items at or below their reorder threshold
 * (reorderPoint, falling back to minStockLevel) that have no open reorder yet,
 * then notifies ADMIN/MANAGER users. Closes the loop the low-stock job opens.
 *
 * The item lookup already excludes items with an open reorder, but two runs (or
 * a concurrent manual raise) can still race to insert — the partial unique
 * index rejects the loser with a P2002 we swallow, so the item is simply left
 * for its existing open reorder.
 */
export const checkReorders = async (): Promise<void> => {
  const [items, recipients] = await Promise.all([
    reordersRepository.findItemsNeedingReorder(),
    usersRepository.findByRoles([Role.ADMIN, Role.MANAGER]),
  ]);

  if (!items.length) {
    logger.info({ job: "checkReorders", items: 0 }, "nothing to reorder");

    return;
  }

  let raised = 0;

  for (const item of items) {
    const quantity = resolveReorderQuantity(item);
    const reorder = await raiseReorder(item, quantity);

    if (!reorder) continue; // already has an open reorder

    raised += 1;

    if (recipients.length) {
      await notifyReorderRaised(item, reorder.id, quantity, recipients);
    }
  }

  logger.info({ job: "checkReorders", candidates: items.length, raised }, "completed");
};
