import { Request, Response } from "express";
import { mock } from "jest-mock-extended";

import { loggerMock } from "../../mocks";

jest.mock("../../../src/config", () => ({
  env: { NODE_ENV: "test" },
  logger: loggerMock,
}));

jest.mock("../../../src/modules/auth/auth.service", () => ({
  authService: {
    login: jest.fn(),
  },
}));

import { env } from "../../../src/config";
import { authController } from "../../../src/modules/auth/auth.controller";
import { authService } from "../../../src/modules/auth/auth.service";

describe("authController.login — refresh token cookie options", () => {
  const loginMock = authService.login as jest.MockedFunction<typeof authService.login>;

  const buildReq = (): Request => mock<Request>({ body: { email: "a@b.com", password: "x" } });

  const buildRes = (): Response => {
    const res = mock<Response>();

    res.status.mockReturnThis();

    return res;
  };

  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  beforeEach(() => {
    loginMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      roles: ["TECHNICIAN"],
    });
  });

  it("should set a cross-site-compatible cookie (SameSite=None, Secure) in production", async () => {
    env.NODE_ENV = "production";
    const res = buildRes();

    await authController.login(buildReq(), res);

    expect(res.cookie).toHaveBeenCalledWith(
      "jwt",
      "refresh-token",
      expect.objectContaining({ sameSite: "none", secure: true }),
    );
  });

  it("should set a same-site cookie (SameSite=Lax, not Secure) outside production", async () => {
    env.NODE_ENV = "test";
    const res = buildRes();

    await authController.login(buildReq(), res);

    expect(res.cookie).toHaveBeenCalledWith(
      "jwt",
      "refresh-token",
      expect.objectContaining({ sameSite: "lax", secure: false }),
    );
  });
});
