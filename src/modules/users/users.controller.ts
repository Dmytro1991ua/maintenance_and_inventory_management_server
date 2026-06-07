import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type { UsersQuery } from "./users.schemas";
import { usersService } from "./users.service";

/**
 * Users controller — HTTP layer only.
 * Reads from req, calls service, sends response.
 */
export const usersController = {
  // GET /api/v1/users
  findAll: async (req: Request, res: Response): Promise<void> => {
    // req.query is ParsedQs by default; validateQuery(UsersQuerySchema) has already
    // coerced and validated the values, so the cast is safe.
    const result = await usersService.findAll(req.query as unknown as UsersQuery);

    res.json({ success: true, ...result });
  },

  // GET /api/v1/users/me
  getMe: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    const user = await usersService.findById(req.user.id);

    res.json({ success: true, data: user });
  },

  // GET /api/v1/users/:id
  findById: async (req: Request, res: Response): Promise<void> => {
    // Express 5 types params as string | string[] — route segment params are always
    // a single string, and validateParams(UserIdParamSchema) has already validated it.
    const user = await usersService.findById(req.params.id as string);

    res.json({ success: true, data: user });
  },

  // PATCH /api/v1/users/:id
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

  // PATCH /api/v1/users/:id/roles
  updateRoles: async (req: Request, res: Response): Promise<void> => {
    const user = await usersService.updateRoles(req.params.id as string, req.body);

    res.json({ success: true, data: user });
  },

  // DELETE /api/v1/users/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    await usersService.delete(req.params.id as string, req.user.id);

    res.status(204).send();
  },
};
