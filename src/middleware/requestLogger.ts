import { randomUUID } from "node:crypto";

import { NextFunction, Request, Response } from "express";

import { logger } from "../config";
import { getLogLevel } from "../utils";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Logs every HTTP request with method, path, status, duration, and requestId.
 * Must be registered FIRST in app.ts — before any routes.
 *
 * requestId is:
 *   - read from the incoming X-Request-Id header when present (pass-through from a load balancer or API gateway);
 *  - otherwise a new UUID is generated attached to req so downstream middleware and controllers can reference it echoed back in the response header for   client-side debugging included in every log line for tracing a request across log entries
 *
 * Listens to both "finish" (response fully sent) and "close" (connection closed)
 * so aborted/client-disconnect requests are also captured — not just completed ones.
 * The "logged" flag prevents double-logging on normal completions where both events fire.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header(REQUEST_ID_HEADER) ?? randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  let logged = false;

  const log = () => {
    if (logged) return;

    logged = true;

    const durationMs = Date.now() - startedAt;

    logger[getLogLevel(res.statusCode)](
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration: `${durationMs}ms`,
        ip: req.ip,
      },
      "http",
    );
  };

  res.on("finish", log);
  res.on("close", log);

  next();
};
