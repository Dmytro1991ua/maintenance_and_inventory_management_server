import { Request, Response, NextFunction } from "express";
import { mock } from "jest-mock-extended";
import { asyncHandler } from "../../../src/middleware/asyncHandler";

describe("asyncHandler", () => {
  const next: jest.MockedFunction<NextFunction> = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call the wrapped handler with req, res, next", async () => {
    const mockHandler = jest.fn().mockResolvedValue(undefined);

    const wrapped = asyncHandler(mockHandler);

    const req = mock<Request>();
    const res = mock<Response>();

    await wrapped(req, res, next);

    expect(mockHandler).toHaveBeenCalledWith(req, res, next);
  });

  it("should not call next() when the handler resolves successfully", async () => {
    const mockHandler = jest.fn().mockResolvedValue(undefined);

    const wrapped = asyncHandler(mockHandler);

    await wrapped(mock<Request>(), mock<Response>(), next);

    expect(next).not.toHaveBeenCalled();
  });

  it("should call next(error) when the wrapped handler rejects", async () => {
    const mockThrownError = new Error("Database connection lost");

    const mockHandler = jest.fn().mockRejectedValue(mockThrownError);

    const wrapped = asyncHandler(mockHandler);

    await wrapped(mock<Request>(), mock<Response>(), next);

    expect(next).toHaveBeenCalledWith(mockThrownError);
  });

  it("should call next(error) when the wrapped handler throws synchronously", async () => {
    const mockThrownError = new Error("Synchronous failure");

    const mockHandler = jest.fn().mockImplementation(() => {
      throw mockThrownError;
    });
    const wrapped = asyncHandler(mockHandler);

    await wrapped(mock<Request>(), mock<Response>(), next);

    expect(next).toHaveBeenCalledWith(mockThrownError);
  });
});
