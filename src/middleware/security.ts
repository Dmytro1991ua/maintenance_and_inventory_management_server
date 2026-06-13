import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "../config";

/**
 * helmet — sets secure HTTP response headers automatically.
 * Protects against common web vulnerabilities:
 *   - XSS (Content-Security-Policy)
 *   - clickjacking (X-Frame-Options)
 *   - MIME sniffing (X-Content-Type-Options)
 *   - and more — 14 headers configured by default
 *
 * crossOriginResourcePolicy overridden to "cross-origin": Helmet 8 defaults
 * to "same-origin" which blocks cross-origin no-cors fetches of this API.
 */
export const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

/**
 * cors — controls which origins can make cross-origin requests.
 *
 * Strict in all environments — ALLOWED_ORIGINS must list every origin
 * that needs access, including local frontend dev URLs. This ensures
 * CORS misconfiguration is caught locally, not discovered in production.
 *
 * credentials: true — required for HttpOnly cookies to be sent
 * cross-origin (refresh token cookie won't work without this)
 */
const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

export const corsMiddleware = cors({
  origin: allowedOrigins,
  credentials: true, // required for HttpOnly cookie (refresh token)
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
});

/**
 * Request size limit — prevents payload too large attacks.
 * 10kb is generous for a JSON API — adjust if you expect file uploads.
 * Default Express limit is 100kb which is too permissive.
 */
export const jsonSizeLimit = express.json({ limit: "10kb" });

/**
 * URL-encoded body size limit — same protection for form submissions.
 */
export const urlencodedSizeLimit = express.urlencoded({
  extended: false,
  limit: "10kb",
});
