import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { mock } from "jest-mock-extended";
import { UnauthorizedError } from "../../../src/errors";
import { authenticate } from "../../../src/middleware/authenticate";
import type { JwtVerifyFn } from "../../types/mocks.types";

jest.mock("../../../src/config", () => ({
  env: { ACCESS_TOKEN_SECRET: "test-access-secret-at-least-32-characters-long" },
}));

jest.mock("jsonwebtoken");

describe("authenticate", () => {
  const mockedJwt = {
    verify: jwt.verify as unknown as jest.MockedFunction<JwtVerifyFn>,
  };

  const buildReq = (authHeader?: string): Request => {
    const req = mock<Request>();

    req.headers = authHeader ? { authorization: authHeader } : {};

    return req;
  };

  const next: jest.MockedFunction<NextFunction> = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw UnauthorizedError when the Authorization header is missing", () => {
    const mockReq = buildReq();

    expect(() => authenticate(mockReq, mock<Response>(), next)).toThrow(UnauthorizedError);
  });

  it("should throw UnauthorizedError when the header does not start with 'Bearer '", () => {
    const mockReq = buildReq("Basic some-credentials");

    expect(() => authenticate(mockReq, mock<Response>(), next)).toThrow(UnauthorizedError);
  });

  it("should attach the decoded user to req.user on a valid token", () => {
    const mockReq = buildReq("Bearer valid-token");

    mockedJwt.verify.mockReturnValue({
      UserInfo: { id: "user-1", userName: "johndoe", roles: ["TECHNICIAN"] },
    });

    authenticate(mockReq, mock<Response>(), next);

    expect(mockReq.user).toEqual({ id: "user-1", userName: "johndoe", roles: ["TECHNICIAN"] });
  });

  it("should call next() with no arguments on a valid token", () => {
    const mockReq = buildReq("Bearer valid-token");

    mockedJwt.verify.mockReturnValue({
      UserInfo: { id: "user-1", userName: "johndoe", roles: ["TECHNICIAN"] },
    });

    authenticate(mockReq, mock<Response>(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should throw UnauthorizedError with 'Token expired' when the token has expired", () => {
    const mockReq = buildReq("Bearer expired-token");

    mockedJwt.verify.mockImplementation(() => {
      throw new jwt.TokenExpiredError("jwt expired", new Date());
    });

    expect(() => authenticate(mockReq, mock<Response>(), next)).toThrow("Token expired");
  });

  it("should throw UnauthorizedError with 'Invalid token' when the signature is invalid", () => {
    const mockReq = buildReq("Bearer tampered-token");

    mockedJwt.verify.mockImplementation(() => {
      throw new jwt.JsonWebTokenError("invalid signature");
    });

    expect(() => authenticate(mockReq, mock<Response>(), next)).toThrow("Invalid token");
  });

  it("should rethrow unexpected errors instead of converting them to UnauthorizedError", () => {
    const mockReq = buildReq("Bearer some-token");

    const unexpectedError = new Error("Something else entirely");

    mockedJwt.verify.mockImplementation(() => {
      throw unexpectedError;
    });

    expect(() => authenticate(mockReq, mock<Response>(), next)).toThrow(unexpectedError);
  });
});
