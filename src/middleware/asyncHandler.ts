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
    try {
      // fn(...) is called inside the try so a synchronous throw is caught
      // immediately; an async rejection still flows through .catch(next).
      Promise.resolve(fn(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
};
