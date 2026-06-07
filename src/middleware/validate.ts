import { NextFunction, Request, Response } from "express";
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
    const parsedQuery = schema.parse(req.query);

    // Express 5 defines req.query as a getter-only accessor on its prototype
    // (see express/lib/request.js — `defineGetter`, no setter), so a direct
    // assignment throws "Cannot set property query of ... which has only a
    // getter". Redefining it as an own, writable data property on this
    // request shadows the prototype getter — the standard workaround for
    // validation/parsing middleware under Express 5.
    Object.defineProperty(req, "query", {
      value: parsedQuery,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    next();
  };
