import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { mock } from "jest-mock-extended";
import { ForbiddenError, UnauthorizedError } from "../../../src/errors";
import { authenticate } from "../../../src/middleware/authenticate";
import { usersRepository } from "../../../src/modules/users/users.repository";
import type { JwtVerifyFn } from "../../types/mocks.types";

jest.mock("../../../src/config", () => ({
  env: { ACCESS_TOKEN_SECRET: "test-access-secret-at-least-32-characters-long" },
}));

jest.mock("jsonwebtoken");
jest.mock("../../../src/modules/users/users.repository", () => ({
  usersRepository: { findStatus: jest.fn() },
}));

describe("authenticate", () => {
  const mockedJwt = {
    verify: jwt.verify as unknown as jest.MockedFunction<JwtVerifyFn>,
  };
  const findStatus = usersRepository.findStatus as unknown as jest.Mock;

  const buildReq = (authHeader?: string): Request => {
    const req = mock<Request>();

    req.headers = authHeader ? { authorization: authHeader } : {};

    return req;
  };

  const next: jest.MockedFunction<NextFunction> = jest.fn();

  const validToken = () =>
    mockedJwt.verify.mockReturnValue({
      UserInfo: { id: "user-1", userName: "johndoe", roles: ["TECHNICIAN"] },
    });

  beforeEach(() => {
    findStatus.mockResolvedValue({ status: "ACTIVE" });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should throw UnauthorizedError when the Authorization header is missing", async () => {
    await expect(authenticate(buildReq(), mock<Response>(), next)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("should throw UnauthorizedError when the header does not start with 'Bearer '", async () => {
    await expect(
      authenticate(buildReq("Basic some-credentials"), mock<Response>(), next),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("should attach the decoded user to req.user on a valid token", async () => {
    const mockReq = buildReq("Bearer valid-token");
    validToken();

    await authenticate(mockReq, mock<Response>(), next);

    expect(mockReq.user).toEqual({ id: "user-1", userName: "johndoe", roles: ["TECHNICIAN"] });
  });

  it("should call next() with no arguments on a valid token", async () => {
    validToken();

    await authenticate(buildReq("Bearer valid-token"), mock<Response>(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should look the user up by the id in the token", async () => {
    validToken();

    await authenticate(buildReq("Bearer valid-token"), mock<Response>(), next);

    expect(findStatus).toHaveBeenCalledWith("user-1");
  });

  it("should throw ForbiddenError and not call next() when the user is inactive", async () => {
    const mockReq = buildReq("Bearer valid-token");
    validToken();
    findStatus.mockResolvedValue({ status: "INACTIVE" });

    await expect(authenticate(mockReq, mock<Response>(), next)).rejects.toThrow(ForbiddenError);

    expect(next).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedError when the user no longer exists", async () => {
    validToken();
    findStatus.mockResolvedValue(null);

    await expect(
      authenticate(buildReq("Bearer valid-token"), mock<Response>(), next),
    ).rejects.toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it("should not look the user up when the token is invalid", async () => {
    mockedJwt.verify.mockImplementation(() => {
      throw new jwt.JsonWebTokenError("invalid signature");
    });

    await expect(
      authenticate(buildReq("Bearer tampered-token"), mock<Response>(), next),
    ).rejects.toThrow("Invalid token");
    expect(findStatus).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedError with 'Token expired' when the token has expired", async () => {
    mockedJwt.verify.mockImplementation(() => {
      throw new jwt.TokenExpiredError("jwt expired", new Date());
    });

    await expect(
      authenticate(buildReq("Bearer expired-token"), mock<Response>(), next),
    ).rejects.toThrow("Token expired");
  });

  it("should rethrow unexpected errors instead of converting them to UnauthorizedError", async () => {
    const unexpectedError = new Error("Something else entirely");

    mockedJwt.verify.mockImplementation(() => {
      throw unexpectedError;
    });

    await expect(
      authenticate(buildReq("Bearer some-token"), mock<Response>(), next),
    ).rejects.toThrow(unexpectedError);
  });
});
