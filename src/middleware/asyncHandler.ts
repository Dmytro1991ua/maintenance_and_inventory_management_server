import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route handler so errors propagate to the global error handler
 * automatically — without needing try/catch in every controller.
 *
 * Without this, an unhandled async rejection in Express 4 hangs the request.
 *
 * Usage:
 *   router.get("/users", asyncHandler(async (req, res) => {
 *     const users = await userService.findAll();
 *     res.json({ success: true, data: users });
 *   }));
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
