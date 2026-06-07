import { Router } from "express";

import { asyncHandler, authLimiter, validateBody } from "../../middleware";
import { authController } from "./auth.controller";
import { LoginSchema, RegisterSchema } from "./auth.schemas";

const router = Router();

/**
 * POST /api/v1/auth/register
 * Public — validates body, creates user, returns id + userName + email
 */
router.post(
  "/register",
  authLimiter,
  validateBody(RegisterSchema),
  asyncHandler(authController.register),
);

/**
 * POST /api/v1/auth/login
 * Public — validates body, returns accessToken in body + refreshToken in HttpOnly cookie
 */
router.post("/login", authLimiter, validateBody(LoginSchema), asyncHandler(authController.login));

/**
 * POST /api/v1/auth/refresh
 * Public — reads refreshToken from HttpOnly cookie, rotates it, returns new accessToken
 */
router.post("/refresh", asyncHandler(authController.refresh));

/**
 * POST /api/v1/auth/logout
 * Public — clears HttpOnly cookie, removes token from Redis
 */
router.post("/logout", asyncHandler(authController.logout));

export default router;
