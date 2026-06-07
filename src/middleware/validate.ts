import { NextFunction, Request, Response } from "express";
import type { ParsedQs } from "qs";
import { z } from "zod";

/**
 * Validates req.body against a Zod schema.
 * Used on POST / PATCH / PUT routes where client sends data in the body.
 */
export const validateBody =
  <T>(schema: z.ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);

    next();
  };

/**
 * Validates req.params against a Zod schema.
 * Used on routes with URL path parameters like GET /users/:id
 */
// Route segment params are always strings — constrain T accordingly.
export const validateParams =
  <T extends Record<string, string>>(schema: z.ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.params = schema.parse(req.params);

    next();
  };

/**
 * Validates req.query against a Zod schema.
 * Used on GET routes that accept filters, pagination, or sorting.
 */
export const validateQuery =
  <T>(schema: z.ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    // Zod may coerce query strings to numbers/booleans — cast required since
    // Express types req.query as ParsedQs (string values only).
    req.query = schema.parse(req.query) as unknown as ParsedQs;

    next();
  };
