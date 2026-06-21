import { Request, Response, NextFunction } from "express";
import { mock } from "jest-mock-extended";
import { Role } from "../../../src/generated/prisma/client";
import { authorize } from "../../../src/middleware/authorize";
import { ForbiddenError } from "../../../src/errors";

describe("authorize middleware", () => {
  const buildReq = (roles: Role[]): Request => {
    const req = mock<Request>();

    req.user = { id: "user-1", userName: "test", roles };

    return req;
  };

  const next: jest.MockedFunction<NextFunction> = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should call next() when user has one of the allowed roles", () => {
    const req = buildReq([Role.ADMIN]);

    const middleware = authorize([Role.ADMIN, Role.MANAGER]);

    middleware(req, mock<Response>(), next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments — success path
  });

  it("should call next() when user has at least one matching role among several", () => {
    const req = buildReq([Role.TECHNICIAN, Role.MANAGER]);

    const middleware = authorize([Role.MANAGER]);

    middleware(req, mock<Response>(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should throw ForbiddenError when user has none of the allowed roles", () => {
    const req = buildReq([Role.TECHNICIAN]);

    const middleware = authorize([Role.ADMIN]);

    expect(() => middleware(req, mock<Response>(), next)).toThrow(ForbiddenError);
  });

  it("should throw ForbiddenError when req.user is missing (authenticate was skipped)", () => {
    // Deliberately off-contract: the real Express.Request type declares `user`
    // as always present (set by authenticate), so this state can only be
    // constructed by bypassing the type system — which is exactly the bug
    // this test guards against.
    const req = {} as Request;

    const middleware = authorize([Role.ADMIN]);

    expect(() => middleware(req, mock<Response>(), next)).toThrow(ForbiddenError);
  });
});
