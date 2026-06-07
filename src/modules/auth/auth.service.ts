import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { v4 as uuid } from "uuid";

import { env, logger, redis } from "../../config";
import { ConflictError, UnauthorizedError } from "../../errors";
import { BCRYPT_SALT_ROUNDS, DUMMY_HASH, REFRESH_TOKEN_TTL_SECONDS } from "./auth.constants";
import { authRepository } from "./auth.repository";
import { LoginInput, RegisterInput } from "./auth.schemas";
import { getRefreshTokenKey, getUserSessionKey } from "./auth.utils";

const storeRefreshToken = async (userId: string, tokenId: string, token: string): Promise<void> => {
  // Pipeline: three operations writes in one Redis round trip
  await redis
    .pipeline()
    .set(getRefreshTokenKey(userId, tokenId), token, "EX", REFRESH_TOKEN_TTL_SECONDS)
    .sadd(getUserSessionKey(userId), tokenId)
    .expire(getUserSessionKey(userId), REFRESH_TOKEN_TTL_SECONDS)
    .exec();
};

const deleteRefreshToken = async (userId: string, tokenId: string): Promise<void> => {
  // Pipeline: two operations deletes in one Redis round trip
  await redis
    .pipeline()
    .del(getRefreshTokenKey(userId, tokenId))
    .srem(getUserSessionKey(userId), tokenId)
    .exec();
};

const revokeAllSessions = async (userId: string): Promise<void> => {
  // Fetch token IDs first — needed to build the delete pipeline.
  // A read-then-delete cannot be batched into a single pipeline.
  const tokenIds = await redis.smembers(getUserSessionKey(userId));

  if (tokenIds.length === 0) return;

  await redis
    .pipeline()
    .del(...tokenIds.map((id) => getRefreshTokenKey(userId, id)), getUserSessionKey(userId))
    .exec();
};

const signAccessToken = (userId: string, userName: string, roles: string[]): string =>
  jwt.sign({ UserInfo: { id: userId, userName, roles } }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
  });

const signRefreshToken = (userId: string, tokenId: string): string =>
  jwt.sign({ sub: userId, jti: tokenId }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
  });

// Reuse detection is called when a refresh token is NOT found in Redis.
//
// CASE A — garbage token (fake / expired / tampered)
//   → jwt.verify throws JsonWebTokenError → nothing to wipe, return silently
//
// CASE B — token was real but already rotated out of Redis
//   → jwt.verify succeeds (we signed it) → stolen token being replayed
//   → wipe ALL sessions for this user across every device immediately

const handleReuseAttack = async (token: string): Promise<void> => {
  let decoded: jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) return; // Case A — garbage, nothing to wipe

    throw err; // unexpected error
  }

  // Case B — valid signature but not in Redis → stolen token replayed
  try {
    logger.warn(
      { userId: decoded.sub },
      "Refresh token reuse attack detected — wiping all sessions",
    );

    if (decoded.sub) await revokeAllSessions(decoded.sub);
  } catch (err) {
    logger.error({ err }, "Failed to wipe sessions during reuse attack");
  }
};

export const authService = {
  register: async (input: RegisterInput) => {
    const [existingEmail, existingUserName] = await Promise.all([
      authRepository.findByEmail(input.email),
      authRepository.findByUserName(input.userName),
    ]);

    if (existingEmail) throw new ConflictError("Email already in use");
    if (existingUserName) throw new ConflictError("Username already taken");

    const hashedPassword = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    const user = await authRepository.create({
      ...input,
      password: hashedPassword,
    });

    // Never return the password hash — even hashed
    return { id: user.id, userName: user.userName, email: user.email };
  },
  login: async (input: LoginInput) => {
    const user = await authRepository.findByEmail(input.email);

    // Always run bcrypt even when the user doesn't exist.
    // Without this, "user not found" returns in ~1ms while "wrong password"
    // takes ~300ms — a timing difference that reveals which emails are registered.
    const match = await bcrypt.compare(input.password, user?.password ?? DUMMY_HASH);

    if (!user || !match) throw new UnauthorizedError("Invalid credentials");

    // Unique identifier for a refresh-token session (jti)
    // Allows tracking, rotating, and revoking individual login sessions per device
    const tokenId = uuid();

    const roles = user.roles.map(String);

    const accessToken = signAccessToken(user.id, user.userName, roles);
    const refreshToken = signRefreshToken(user.id, tokenId);

    await storeRefreshToken(user.id, tokenId, refreshToken);

    return { accessToken, refreshToken, roles };
  },
  refresh: async (incomingToken: string) => {
    // Decode without verifying — need userId + tokenId for Redis lookup
    // before verification. jwt.decode never throws.
    const decodedToken = jwt.decode(incomingToken) as jwt.JwtPayload | null;

    if (!decodedToken?.sub || !decodedToken?.jti) throw new UnauthorizedError("Invalid token");

    const { sub: userId, jti: tokenId } = decodedToken;

    // Redis is source of truth — not here means invalid or already rotated
    const storedToken = await redis.get(getRefreshTokenKey(userId, tokenId));

    if (!storedToken) {
      await handleReuseAttack(incomingToken);

      throw new UnauthorizedError("Invalid token");
    }

    // Verify JWT signature + expiry now that Redis confirms it exists
    try {
      jwt.verify(incomingToken, env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        await deleteRefreshToken(userId, tokenId);

        throw new UnauthorizedError("Invalid token");
      }

      throw err;
    }

    // Load user — only after Redis confirms session is valid.
    // Keeps DB load off the hot path for invalid tokens.
    const user = await authRepository.findById(userId);

    if (!user) {
      await revokeAllSessions(userId);

      throw new UnauthorizedError("Invalid token");
    }

    // Refresh Token Rotation — old token dies, new pair issued
    await deleteRefreshToken(userId, tokenId);

    const newTokenId = uuid();
    const roles = user.roles.map(String);

    const newAccessToken = signAccessToken(user.id, user.userName, roles);
    const newRefreshToken = signRefreshToken(user.id, newTokenId);

    await storeRefreshToken(user.id, newTokenId, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, roles };
  },
  logout: async (incomingToken: string): Promise<void> => {
    const decodedToken = jwt.decode(incomingToken) as jwt.JwtPayload | null;

    // Malformed token — silently succeed.
    // Cookie is cleared by the controller regardless, so user is logged out.
    if (!decodedToken?.sub || !decodedToken?.jti) return;

    try {
      await deleteRefreshToken(decodedToken.sub, decodedToken.jti);
    } catch (err) {
      // Log but never throw — logout must always succeed from the user's perspective
      logger.error({ err }, "Failed to delete refresh token on logout");
    }
  },
};
