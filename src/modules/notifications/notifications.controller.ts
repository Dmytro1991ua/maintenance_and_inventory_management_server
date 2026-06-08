import { Request, Response } from "express";

import type {
  NotificationIdParam,
  NotificationsQuery,
  UpdateNotification,
} from "./notifications.schemas";
import { notificationsService } from "./notifications.service";

/**
 * Notifications controller — HTTP layer only.
 */
export const notificationsController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as NotificationsQuery;

    const result = await notificationsService.findAll(req.user.id, query);

    res.json({ success: true, ...result });
  },
  countUnread: async (req: Request, res: Response): Promise<void> => {
    const result = await notificationsService.countUnread(req.user.id);

    res.json({ success: true, data: result });
  },
  markAllAsRead: async (req: Request, res: Response): Promise<void> => {
    const result = await notificationsService.markAllAsRead(req.user.id);

    res.json({ success: true, data: result });
  },
  update: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as NotificationIdParam;

    const data = req.body as UpdateNotification;

    const notification = await notificationsService.update(id, data, req.user.id);

    res.json({ success: true, data: notification });
  },
  delete: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as NotificationIdParam;

    await notificationsService.delete(id, req.user.id);

    res.status(204).send();
  },
};
