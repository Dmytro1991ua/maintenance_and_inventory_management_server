import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Validates req.body against a Zod schema.
 * Used on POST / PATCH / PUT routes where client sends data in the body.
 */
export const validateBody =
  (schema: z.ZodType) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);

    next();
  };

/**
 * Validates req.params against a Zod schema.
 * Used on routes with URL path parameters like GET /users/:id
 */
export const validateParams =
  (schema: z.ZodType) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.params = schema.parse(req.params) as Record<string, string>;

    next();
  };

/**
 * Validates req.query against a Zod schema.
 * Used on GET routes that accept filters, pagination, or sorting.
 */
export const validateQuery =
  (schema: z.ZodType) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as Record<string, string>;

    next();
  };
