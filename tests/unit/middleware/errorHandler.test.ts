import { Request, Response, NextFunction } from "express";
import { mock } from "jest-mock-extended";
import { ZodError, z } from "zod";

import { NotFoundError } from "../../../src/errors";
import { loggerMock } from "../../mocks";
import { errorHandler } from "../../../src/middleware/errorHandler";

jest.mock("../../../src/config", () => ({
  env: { NODE_ENV: "test" },
  logger: loggerMock,
}));

import { env } from "../../../src/config";

describe("errorHandler", () => {
  const buildReq = (): Request => mock<Request>({ method: "GET", path: "/api/v1/test" });

  // errorHandler chains res.status(code).json(body) — the auto-mocked
  // status() returns undefined by default, so it must be wired to return
  // the same mock for the chained .json() call to have something to land on.
  const buildRes = (): Response => {
    const res = mock<Response>();

    res.status.mockReturnThis();

    return res;
  };

  const next: jest.MockedFunction<NextFunction> = jest.fn();

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe("when the error is an AppError", () => {
    it("should respond with the error's own status code", () => {
      const mockRes = buildRes();
      const mockErr = new NotFoundError("Task not found");

      errorHandler(mockErr, buildReq(), mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("should respond with the error's code and message in the body", () => {
      const mockRes = buildRes();
      const mockErr = new NotFoundError("Task not found");

      errorHandler(mockErr, buildReq(), mockRes, next);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: { code: "NOT_FOUND", message: "Task not found" },
      });
    });

    it("should log the error as a warning, not an error", () => {
      const mockRes = buildRes();
      const mockErr = new NotFoundError("Task not found");

      errorHandler(mockErr, buildReq(), mockRes, next);

      expect(loggerMock.warn).toHaveBeenCalled();
      expect(loggerMock.error).not.toHaveBeenCalled();
    });
  });

  describe("when the error is a ZodError", () => {
    const buildZodError = (): ZodError => {
      const schema = z.object({ email: z.email() });

      const result = schema.safeParse({ email: "not-an-email" });

      if (result.success) {
        throw new Error("Expected schema validation to fail for this fixture");
      }

      return result.error;
    };

    it("should respond with status 400", () => {
      const mockRes = buildRes();

      errorHandler(buildZodError(), buildReq(), mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should respond with VALIDATION_ERROR code and field-level errors", () => {
      const mockRes = buildRes();

      errorHandler(buildZodError(), buildReq(), mockRes, next);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
        }),
      );
    });
  });

  describe("when the error is unknown/unexpected", () => {
    it("should respond with status 500", () => {
      const mockRes = buildRes();
      const mockErr = new Error("Something exploded");

      errorHandler(mockErr, buildReq(), mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("should respond with INTERNAL_SERVER_ERROR code", () => {
      const mockRes = buildRes();
      const mockErr = new Error("Something exploded");

      errorHandler(mockErr, buildReq(), mockRes, next);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
        }),
      );
    });

    it("should log the full error at error level", () => {
      const mockRes = buildRes();
      const mockErr = new Error("Something exploded");

      errorHandler(mockErr, buildReq(), mockRes, next);

      expect(loggerMock.error).toHaveBeenCalled();
    });

    describe("and NODE_ENV is production", () => {
      const originalNodeEnv = env.NODE_ENV;

      afterEach(() => {
        env.NODE_ENV = originalNodeEnv;
      });

      it("should hide the real error message from the response", () => {
        env.NODE_ENV = "production";
        const mockRes = buildRes();
        const mockErr = new Error("Sensitive: DB password is hunter2");

        errorHandler(mockErr, buildReq(), mockRes, next);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ message: "Something went wrong" }),
          }),
        );
      });
    });

    describe("and NODE_ENV is not production", () => {
      const originalNodeEnv = env.NODE_ENV;

      afterEach(() => {
        env.NODE_ENV = originalNodeEnv;
      });

      it("should include the real error message in the response", () => {
        env.NODE_ENV = "test";
        const mockRes = buildRes();
        const mockErr = new Error("Something exploded");

        errorHandler(mockErr, buildReq(), mockRes, next);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ message: "Something exploded" }),
          }),
        );
      });
    });
  });
});
