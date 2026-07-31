import { Request, Response } from "express";

import { BadRequestError, UnauthorizedError } from "../../errors";
import { invitesService } from "./invites.service";
import type { UsersQuery } from "./users.schemas";
import { usersService } from "./users.service";

/**
 * Users controller — HTTP layer only.
 */
export const usersController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    // req.query is ParsedQs by default; validateQuery(UsersQuerySchema) has already
    // coerced and validated the values, so the cast is safe.
    const result = await usersService.findAll(req.query as unknown as UsersQuery);

    res.json({ success: true, ...result });
  },
  getMe: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    const user = await usersService.findById(req.user.id);

    res.json({ success: true, data: user });
  },
  findById: async (req: Request, res: Response): Promise<void> => {
    // Express 5 types params as string | string[] — route segment params are always
    // a single string, and validateParams(UserIdParamSchema) has already validated it.
    const user = await usersService.findById(req.params.id as string);

    res.json({ success: true, data: user });
  },
  update: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    const user = await usersService.update(req.params.id as string, req.body, {
      id: req.user.id,
      roles: req.user.roles,
    });

    res.json({ success: true, data: user });
  },
  updateRoles: async (req: Request, res: Response): Promise<void> => {
    const user = await usersService.updateRoles(req.params.id as string, req.body);

    res.json({ success: true, data: user });
  },
  delete: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    await usersService.delete(req.params.id as string, req.user.id);

    res.status(204).send();
  },

  inviteUser: async (req: Request, res: Response): Promise<void> => {
    const result = await invitesService.invite(req.body);

    res.status(201).json({ success: true, data: result });
  },

  getPendingInvites: async (_req: Request, res: Response): Promise<void> => {
    const data = await invitesService.getPendingInvites();

    res.json({ success: true, data });
  },

  cancelInvite: async (req: Request, res: Response): Promise<void> => {
    await invitesService.cancelInvite(req.params.id as string);

    res.status(204).send();
  },

  uploadAvatar: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    if (!req.file) throw new BadRequestError("No file uploaded");

    const user = await usersService.uploadAvatar(req.user.id, req.file);

    res.json({ success: true, data: user });
  },

  changePassword: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    await usersService.changePassword(req.user.id, req.body);

    res.status(204).send();
  },

  updateStatus: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.user!;

    const user = await usersService.updateStatus(req.params.id as string, req.body, id);

    res.json({ success: true, data: user });
  },
};
