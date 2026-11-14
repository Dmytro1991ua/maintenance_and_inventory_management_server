import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { UserStatus } from "../generated/prisma/client";
import { usersRepository } from "../modules/users/users.repository";

type AccessTokenPayload = {
  UserInfo: { id: string };
};

/**
 * Verifies the JWT access token from the Authorization header, then loads the
 * user: a deactivation or role change takes effect at once, not at token expiry.
 * Attaches the user to req.user for downstream middleware and controllers.
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

  const user = await usersRepository.findAuthState(decoded.UserInfo.id);

  if (!user) throw new UnauthorizedError("Invalid token");
  if (user.status === UserStatus.INACTIVE) {
    throw new ForbiddenError("Your account has been deactivated");
  }

  // Roles come from the database, so a role change applies at once.
  req.user = { id: decoded.UserInfo.id, userName: user.userName, roles: user.roles };

  next();
};
