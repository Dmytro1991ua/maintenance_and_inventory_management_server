import { logger } from "../../../config";
import { NotificationType, Role } from "../../../generated/prisma/client";
import { inventoryRepository } from "../../../modules/inventory/inventory.repository";
import { buildLowStockMessage } from "../../../modules/inventory/inventory.utils";
import { notificationsService } from "../../../modules/notifications/notifications.service";
import { usersRepository } from "../../../modules/users/users.repository";

/**
 * Checks for inventory items below their minimum stock level and creates
 * LOW_STOCK notifications for all ADMIN and MANAGER users.
 *
 * Processes per item rather than building one large cross-product array —
 * avoids loading N items × M recipients into memory simultaneously, and lets
 * one item's failure be retried without affecting the rest.
 */
export const checkLowStock = async (): Promise<void> => {
  const [lowStockItems, recipients] = await Promise.all([
    inventoryRepository.findLowStock(),
    usersRepository.findByRoles([Role.ADMIN, Role.MANAGER]),
  ]);

  if (!lowStockItems.length || !recipients.length) {
    logger.info(
      { job: "checkLowStock", items: lowStockItems.length, recipients: recipients.length },
      "nothing to notify",
    );

    return;
  }

  for (const item of lowStockItems) {
    const notifications = recipients.map(({ id }) => ({
      type: NotificationType.LOW_STOCK,
      message: buildLowStockMessage(item.name, item.quantity, item.minStockLevel),
      userId: id,
      relatedEntityId: item.id,
    }));

    await notificationsService.createMany(NotificationType.LOW_STOCK, notifications);
  }

  logger.info(
    { job: "checkLowStock", items: lowStockItems.length, recipients: recipients.length },
    "completed",
  );
};
