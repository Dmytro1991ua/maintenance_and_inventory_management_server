import { ForbiddenError } from "../errors";

/**
 * Throws ForbiddenError if resourceOwnerId !== requestingUserId.
 * Used when a resource belongs to exactly one user and no role can override.
 *
 * Usage:
 *   ensureOwner(notification.userId, req.user.id, "You can only delete your own notifications");
 *   ensureOwner(task.assignedTo ?? "", req.user.id, "You can only update tasks assigned to you");
 */
export const ensureOwner = (
  resourceOwnerId: string,
  requestingUserId: string,
  message: string,
): void => {
  if (resourceOwnerId !== requestingUserId) {
    throw new ForbiddenError(message);
  }
};
