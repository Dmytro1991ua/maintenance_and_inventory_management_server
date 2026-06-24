import { NextFunction, Request, Response } from "express";
import { isHttpError } from "http-errors";
import { z, ZodError } from "zod";

import { env, logger } from "../config";
import { AppError } from "../errors";

/**
 * Global error handler
 *
 * Four categories:
 *   1. AppError   — our own operational errors (auth, 404, conflict)
 *   2. ZodError   — schema validation failures
 *   3. HttpError  — operational errors from Express/body-parser internals
 *                   (e.g. PayloadTooLargeError) — not ours, but still an
 *                   expected 4xx condition, not a bug
 *   4. Unknown    — unexpected crashes, bugs, third-party failures
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // Operational AppError
  if (err instanceof AppError) {
    logger.warn(
      {
        code: err.code,
        statusCode: err.statusCode,
        message: err.message,
        method: req.method,
        path: req.path,
      },
      "Operational error",
    );

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const { fieldErrors } = z.flattenError(err);

    logger.warn({ fieldErrors, method: req.method, path: req.path }, "Validation error");

    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        fieldErrors,
      },
    });
    return;
  }

  // Operational error from Express/body-parser internals (e.g. a request
  // body over the size limit). These follow the http-errors convention —
  // a numeric statusCode plus an `expose` flag marking the message safe to
  // return to the client — so they get the same 4xx treatment AppError
  // gets, instead of falling through to "unexpected error" as a 500.
  if (isHttpError(err) && err.expose) {
    logger.warn(
      { statusCode: err.statusCode, message: err.message, method: req.method, path: req.path },
      "Operational error",
    );

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: "REQUEST_ERROR",
        message: err.message,
      },
    });
    return;
  }

  // Unexpected error
  // Log the full error — this is a bug or infrastructure failure
  logger.error({ err, method: req.method, path: req.path }, "Unexpected error");

  // Never expose internal details in production
  const message =
    env.NODE_ENV !== "production" && err instanceof Error ? err.message : "Something went wrong";

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
    },
  });
};
