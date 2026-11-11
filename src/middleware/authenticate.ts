import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { Role, UserStatus } from "../generated/prisma/client";
import { usersRepository } from "../modules/users/users.repository";

type AccessTokenPayload = {
  UserInfo: {
    id: string;
    userName: string;
    roles: string[];
  };
};

/**
 * Verifies the JWT access token from the Authorization header, then checks the
 * user still exists and is active, so a deactivation takes effect at once.
 * Attaches decoded user to req.user for downstream middleware and controllers.
 *
 * Usage:
 *   router.get("/me", authenticate, asyncHandler(userController.getMe));
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  // Header must be present and follow "Bearer <token>" format
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("No token provided");
  }

  const token = authHeader.split(" ")[1];
  let decoded: AccessTokenPayload;

  try {
    decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Token expired");
    }

    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid token");
    }

    throw err;
  }

  const user = await usersRepository.findStatus(decoded.UserInfo.id);

  if (!user) throw new UnauthorizedError("Invalid token");
  if (user.status === UserStatus.INACTIVE) {
    throw new ForbiddenError("Your account has been deactivated");
  }

  req.user = {
    id: decoded.UserInfo.id,
    userName: decoded.UserInfo.userName,
    roles: decoded.UserInfo.roles as Role[],
  };

  next();
};
