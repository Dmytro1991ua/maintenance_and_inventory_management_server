import rateLimit from "express-rate-limit";

import { env } from "../config";
import {
  AUTH_RATE_LIMIT_MAX_REQUESTS,
  GENERAL_RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "../constants";

// Integration tests run every request through the real Express app from a
// single process/IP — the in-memory limiter store would otherwise throttle
// the suite itself (5 auth requests per 15 min) rather than anything a real
// client could trigger. Skipped only when NODE_ENV is exactly "test".
const skipInTestEnv = (): boolean => env.NODE_ENV === "test";

/**
 * Strict limiter for auth mutation endpoints.
 * 5 attempts per 15 minutes per IP.
 *
 * Why 5? Enough for a legitimate user who misremembers their password,
 * not enough for a brute-force attack to make meaningful progress.
 *
 * Applied to: POST /auth/login, POST /auth/register, POST /auth/forgot-password, POST /auth/reset-password
 * NOT applied to: /auth/refresh, /auth/logout — these use HttpOnly cookies,
 * not passwords, so brute force is not applicable in the same way.
 */
export const authApiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true, // sends RateLimit-* headers (RFC 6585)
  legacyHeaders: false, // disables X-RateLimit-* headers
  skip: skipInTestEnv,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts — please try again in 15 minutes",
    },
  },
});

/**
 * General limiter for general API endpoints.
 * 100 requests per 15 minutes per IP.
 *
 * Applied to: all routes via app.ts as a global baseline guard.
 */
export const generalApiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: GENERAL_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests — please slow down",
    },
  },
});
