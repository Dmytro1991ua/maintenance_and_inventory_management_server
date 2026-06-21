import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { UnauthorizedError, ConflictError } from "../../../src/errors";
import { authRepositoryMock, buildUser, createRedisMock, loggerMock } from "../../mocks";
import type {
  BcryptCompareFn,
  BcryptHashFn,
  JwtDecodeFn,
  JwtSignFn,
  JwtVerifyFn,
} from "../../types/mocks.types";

jest.mock("../../../src/modules/auth/auth.repository", () => ({
  authRepository: authRepositoryMock,
}));

jest.mock("../../../src/config", () => ({
  env: {
    ACCESS_TOKEN_SECRET: "test-access-secret-at-least-32-characters-long",
    REFRESH_TOKEN_SECRET: "test-refresh-secret-at-least-32-characters-long",
    ACCESS_TOKEN_EXPIRES_IN: "15m",
    REFRESH_TOKEN_EXPIRES_IN: "1d",
  },
  redis: createRedisMock(),
  logger: loggerMock,
}));

jest.mock("bcrypt");
jest.mock("jsonwebtoken");
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-token-id") }));

// Pull the exact mocked `redis` instance the factory above created — same
// object auth.service.ts receives, so assertions observe the real calls.
import { redis } from "../../../src/config";
import { authService } from "../../../src/modules/auth/auth.service";

const mockRedis = redis as unknown as ReturnType<typeof createRedisMock>;

describe("authService", () => {
  const mockedBcrypt = {
    hash: bcrypt.hash as jest.MockedFunction<BcryptHashFn>,
    compare: bcrypt.compare as jest.MockedFunction<BcryptCompareFn>,
  };
  const mockedJwt = {
    sign: jwt.sign as unknown as jest.MockedFunction<JwtSignFn>,
    verify: jwt.verify as unknown as jest.MockedFunction<JwtVerifyFn>,
    decode: jwt.decode as jest.MockedFunction<JwtDecodeFn>,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should create a user when email and username are both available", async () => {
      authRepositoryMock.findByEmail.mockResolvedValue(null);
      authRepositoryMock.findByUserName.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue("hashed-password");
      authRepositoryMock.create.mockResolvedValue(
        buildUser({ id: "new-user", userName: "newuser", email: "new@example.com" }),
      );

      const result = await authService.register({
        userName: "newuser",
        email: "new@example.com",
        password: "Password123",
      });

      expect(result).toEqual({ id: "new-user", userName: "newuser", email: "new@example.com" });
    });

    it("should never include the password hash in the returned user", async () => {
      authRepositoryMock.findByEmail.mockResolvedValue(null);
      authRepositoryMock.findByUserName.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue("hashed-password");
      authRepositoryMock.create.mockResolvedValue(buildUser({ id: "new-user" }));

      const result = await authService.register({
        userName: "newuser",
        email: "new@example.com",
        password: "Password123",
      });

      expect(result).not.toHaveProperty("password");
    });

    it("should throw ConflictError when email is already in use", async () => {
      authRepositoryMock.findByEmail.mockResolvedValue(buildUser());
      authRepositoryMock.findByUserName.mockResolvedValue(null);

      await expect(
        authService.register({
          userName: "newuser",
          email: "taken@example.com",
          password: "Password123",
        }),
      ).rejects.toThrow(ConflictError);

      expect(authRepositoryMock.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictError when username is already taken", async () => {
      authRepositoryMock.findByEmail.mockResolvedValue(null);
      authRepositoryMock.findByUserName.mockResolvedValue(buildUser());

      await expect(
        authService.register({
          userName: "taken",
          email: "new@example.com",
          password: "Password123",
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("login", () => {
    it("should return access and refresh tokens on valid credentials", async () => {
      const mockUser = buildUser({ id: "user-1", email: "user@example.com" });

      authRepositoryMock.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedJwt.sign
        .mockReturnValueOnce("mock-access-token")
        .mockReturnValueOnce("mock-refresh-token");

      const result = await authService.login({
        email: "user@example.com",
        password: "correct-password",
      });

      expect(result.accessToken).toBe("mock-access-token");
      expect(result.refreshToken).toBe("mock-refresh-token");
    });

    it("should persist the new refresh token to Redis", async () => {
      const mockUser = buildUser({ id: "user-1", email: "user@example.com" });

      authRepositoryMock.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedJwt.sign
        .mockReturnValueOnce("mock-access-token")
        .mockReturnValueOnce("mock-refresh-token");

      await authService.login({ email: "user@example.com", password: "correct-password" });

      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it("should throw UnauthorizedError when user does not exist", async () => {
      authRepositoryMock.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: "nobody@example.com", password: "x" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when password does not match", async () => {
      authRepositoryMock.findByEmail.mockResolvedValue(buildUser());
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "user@example.com", password: "wrong-password" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should give the same error for a nonexistent user and a wrong password", async () => {
      // Prevents user enumeration — an attacker should not be able to tell
      // whether an email exists by comparing error messages.
      authRepositoryMock.findByEmail.mockResolvedValue(null);

      const missingUserError = await authService
        .login({ email: "nobody@example.com", password: "x" })
        .catch((err: Error) => err);

      authRepositoryMock.findByEmail.mockResolvedValue(buildUser());
      mockedBcrypt.compare.mockResolvedValue(false);

      const wrongPasswordError = await authService
        .login({ email: "user@example.com", password: "wrong" })
        .catch((err: Error) => err);

      expect((missingUserError as Error).message).toBe((wrongPasswordError as Error).message);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("should rotate the token when it is found in Redis and valid", async () => {
      mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
      mockRedis.get.mockResolvedValue("stored-token-value");
      mockedJwt.verify.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
      authRepositoryMock.findById.mockResolvedValue(buildUser({ id: "user-1" }));
      mockedJwt.sign
        .mockReturnValueOnce("new-access-token")
        .mockReturnValueOnce("new-refresh-token");

      const result = await authService.refresh("incoming-refresh-token");

      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
    });

    it("should remove the old token and store the new one as two separate Redis operations", async () => {
      mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
      mockRedis.get.mockResolvedValue("stored-token-value");
      mockedJwt.verify.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
      authRepositoryMock.findById.mockResolvedValue(buildUser({ id: "user-1" }));
      mockedJwt.sign
        .mockReturnValueOnce("new-access-token")
        .mockReturnValueOnce("new-refresh-token");

      await authService.refresh("incoming-refresh-token");

      expect(mockRedis.pipeline).toHaveBeenCalledTimes(2);
    });

    it("should throw UnauthorizedError when the token is malformed (missing sub/jti)", async () => {
      mockedJwt.decode.mockReturnValue(null);

      await expect(authService.refresh("garbage-token")).rejects.toThrow(UnauthorizedError);
    });

    describe("when the token is not found in Redis", () => {
      it("should throw UnauthorizedError and NOT wipe sessions for a garbage token (Case A)", async () => {
        mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "token-id" });
        mockRedis.get.mockResolvedValue(null);
        mockedJwt.verify.mockImplementation(() => {
          throw new jwt.JsonWebTokenError("invalid signature");
        });

        await expect(authService.refresh("garbage-token")).rejects.toThrow(UnauthorizedError);

        expect(mockRedis.smembers).not.toHaveBeenCalled();
      });

      it("should wipe all sessions for a valid but already-rotated token (Case B — reuse attack)", async () => {
        mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
        mockRedis.get.mockResolvedValue(null);
        mockedJwt.verify.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
        mockRedis.smembers.mockResolvedValue(["token-id-1", "token-id-2"]);

        await expect(authService.refresh("stolen-token")).rejects.toThrow(UnauthorizedError);

        expect(mockRedis.smembers).toHaveBeenCalledWith("auth:sessions:user-1");
      });

      it("should log a warning when a reuse attack is detected", async () => {
        mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
        mockRedis.get.mockResolvedValue(null);
        mockedJwt.verify.mockReturnValue({ sub: "user-1", jti: "old-token-id" });
        mockRedis.smembers.mockResolvedValue(["token-id-1"]);

        await authService.refresh("stolen-token").catch(() => {});

        expect(loggerMock.warn).toHaveBeenCalled();
      });
    });

    it("should throw UnauthorizedError when the user no longer exists", async () => {
      mockedJwt.decode.mockReturnValue({ sub: "deleted-user", jti: "token-id" });
      mockRedis.get.mockResolvedValue("stored-token-value");
      mockedJwt.verify.mockReturnValue({ sub: "deleted-user", jti: "token-id" });
      authRepositoryMock.findById.mockResolvedValue(null);

      await expect(authService.refresh("token-for-deleted-user")).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe("logout", () => {
    it("should remove the refresh token from Redis when the token is well-formed", async () => {
      mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "token-id" });

      await authService.logout("valid-token");

      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it("should not throw when the token is malformed", async () => {
      mockedJwt.decode.mockReturnValue(null);

      await expect(authService.logout("garbage")).resolves.toBeUndefined();
    });

    it("should not touch Redis when the token is malformed", async () => {
      mockedJwt.decode.mockReturnValue(null);

      await authService.logout("garbage");

      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it("should not throw even when Redis removal fails", async () => {
      mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "token-id" });
      mockRedis.pipeline.mockReturnValueOnce({
        set: jest.fn().mockReturnThis(),
        sadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        srem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error("Redis connection lost")),
      });

      await expect(authService.logout("valid-token")).resolves.toBeUndefined();
    });

    it("should log an error when Redis removal fails during logout", async () => {
      mockedJwt.decode.mockReturnValue({ sub: "user-1", jti: "token-id" });
      mockRedis.pipeline.mockReturnValueOnce({
        set: jest.fn().mockReturnThis(),
        sadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        srem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error("Redis connection lost")),
      });

      await authService.logout("valid-token");

      expect(loggerMock.error).toHaveBeenCalled();
    });
  });
});
