import { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

import { env, logger } from "../config";
import { AppError } from "../errors";

/**
 * Global error handler
 *
 * Three categories:
 *   1. AppError  — our own operational errors (auth, 404, conflict)
 *   2. ZodError  — schema validation failures
 *   3. Unknown   — unexpected crashes, bugs, third-party failures
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
