import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config";
import { UnauthorizedError } from "../errors";
import { Role } from "../generated/prisma/client";

type AccessTokenPayload = {
  UserInfo: {
    id: string;
    userName: string;
    roles: string[];
  };
};

/**
 * Verifies the JWT access token from the Authorization header.
 * Attaches decoded user to req.user for downstream middleware and controllers.
 *
 * Usage:
 *   router.get("/me", authenticate, asyncHandler(userController.getMe));
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  // Header must be present and follow "Bearer <token>" format
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;

    req.user = {
      id: decoded.UserInfo.id,
      userName: decoded.UserInfo.userName,
      roles: decoded.UserInfo.roles as Role[],
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Token expired");
    }

    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid token");
    }

    throw err;
  }
};
