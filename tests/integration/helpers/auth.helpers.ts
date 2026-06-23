import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../../../src/config";
import { Role } from "../../../src/generated/prisma/client";

type TokenSubject = {
  id: string;
  userName: string;
  roles: Role[];
};

// Mirrors authService's signAccessToken exactly (same payload shape, same
// secret) — lets tests mint a valid token for any user without going through
// POST /auth/login, which is both slower and subject to the auth rate limiter.
export const signTestAccessToken = (user: TokenSubject): string =>
  jwt.sign({ UserInfo: { id: user.id, userName: user.userName, roles: user.roles } }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
  });

export const authHeader = (token: string): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});
