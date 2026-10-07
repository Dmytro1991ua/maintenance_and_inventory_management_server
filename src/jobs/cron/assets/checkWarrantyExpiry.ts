import { env, logger } from "../../../config";
import { NotificationType, Role } from "../../../generated/prisma/client";
import { assetsRepository } from "../../../modules/assets/assets.repository";
import { buildWarrantyExpiringMessage } from "../../../modules/assets/assets.utils";
import { notificationsService } from "../../../modules/notifications/notifications.service";
import { usersRepository } from "../../../modules/users/users.repository";

/**
 * Reminds ADMIN/MANAGER users of warranties ending within ASSET_WARRANTY_LEAD_DAYS.
 * In-app only; createMany honors each user's WARRANTY_EXPIRING preference.
 *
 * An asset is marked reminded only if someone was actually notified, so the daily
 * run doesn't re-send, while an all-muted asset is re-evaluated later. Changing the
 * warranty date clears the marker (see assetsService.update).
 */
export const checkWarrantyExpiry = async (): Promise<void> => {
  const [assets, recipients] = await Promise.all([
    assetsRepository.findWarrantyExpiring(env.ASSET_WARRANTY_LEAD_DAYS),
    usersRepository.findByRoles([Role.ADMIN, Role.MANAGER]),
  ]);

  if (!assets.length || !recipients.length) {
    logger.info(
      { job: "checkWarrantyExpiry", assets: assets.length, recipients: recipients.length },
      "nothing to notify",
    );

    return;
  }

  const type = NotificationType.WARRANTY_EXPIRING;
  const remindedIds: string[] = [];

  for (const asset of assets) {
    const message = buildWarrantyExpiringMessage(asset.name, asset.warrantyExpiresAt);
    const { created } = await notificationsService.createMany(
      type,
      recipients.map(({ id }) => ({ type, message, userId: id, relatedEntityId: asset.id })),
    );

    if (created > 0) remindedIds.push(asset.id);
  }

  if (remindedIds.length) await assetsRepository.markWarrantyReminded(remindedIds);

  logger.info(
    { job: "checkWarrantyExpiry", candidates: assets.length, reminded: remindedIds.length },
    "completed",
  );
};
