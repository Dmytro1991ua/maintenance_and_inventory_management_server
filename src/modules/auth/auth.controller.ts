import { Request, Response } from "express";

import { env } from "../../config";
import { UnauthorizedError } from "../../errors";
import { REFRESH_TOKEN_COOKIE_MAX_AGE_MS } from "./auth.constants";
import { authService } from "./auth.service";

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

const setRefreshTokenCookie = (res: Response, refreshToken: string): void => {
  res.cookie("jwt", refreshToken, {
    ...REFRESH_TOKEN_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  });
};

const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie("jwt", REFRESH_TOKEN_COOKIE_OPTIONS);
};

export const authController = {
  register: async (req: Request, res: Response): Promise<void> => {
    const result = await authService.register(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  },

  login: async (req: Request, res: Response): Promise<void> => {
    const result = await authService.login(req.body);

    // Refresh token → HttpOnly cookie (JS cannot read it)
    // Access token  → response body (stored in memory by frontend)
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        roles: result.roles,
      },
    });
  },
  refresh: async (req: Request, res: Response): Promise<void> => {
    const incomingToken = req.cookies?.jwt;

    if (!incomingToken) {
      throw new UnauthorizedError("No refresh token provided");
    }

    const result = await authService.refresh(incomingToken);

    // Rotate — service already deleted the old token from Redis; set new cookie
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        roles: result.roles,
      },
    });
  },
  logout: async (req: Request, res: Response): Promise<void> => {
    const incomingToken = req.cookies?.jwt;

    // Always clear the cookie — even if no token present
    clearRefreshTokenCookie(res);

    if (!incomingToken) {
      res.status(204).send();

      return;
    }

    await authService.logout(incomingToken);

    res.status(204).send();
  },
};
