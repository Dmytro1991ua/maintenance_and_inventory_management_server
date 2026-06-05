import { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../errors";

/**
 * Catches any request that didn't match a registered route.
 * Must be registered AFTER all routes, BEFORE the error handler.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
};
