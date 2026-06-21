import { Request, Response, NextFunction } from "express";
import { mock } from "jest-mock-extended";
import { z } from "zod";
import { validateBody, validateParams, validateQuery } from "../../../src/middleware/validate";

describe("validateBody", () => {
  const mockSchema = z.object({ name: z.string().min(1) });

  const next: jest.MockedFunction<NextFunction> = jest.fn();

  afterEach(() => jest.clearAllMocks());

  it("should attach parsed data to req.body and calls next() on valid input", () => {
    const mockReq = mock<Request>({ body: { name: "test" } });

    const middleware = validateBody(mockSchema);

    middleware(mockReq, mock<Response>(), next);

    expect(mockReq.body).toEqual({ name: "test" });
    expect(next).toHaveBeenCalledWith();
  });

  it("should throw ZodError on invalid input", () => {
    const mockReq = mock<Request>({ body: { name: "" } }); // fails min(1)

    const middleware = validateBody(mockSchema);

    expect(() => middleware(mockReq, mock<Response>(), next)).toThrow();
  });
});

describe("validateParams", () => {
  const mockSchema = z.object({ id: z.uuid() });

  const next: jest.MockedFunction<NextFunction> = jest.fn();

  afterEach(() => jest.clearAllMocks());

  it("should attache parsed params to req.params on valid input", () => {
    const mockValidUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

    const mockReq = mock<Request>({ params: { id: mockValidUuid } });

    const middleware = validateParams(mockSchema);

    middleware(mockReq, mock<Response>(), next);

    expect(mockReq.params).toEqual({ id: mockValidUuid });
  });

  it("should throw ZodError when id is not a valid UUID", () => {
    const mockReq = mock<Request>({ params: { id: "not-a-uuid" } });

    const middleware = validateParams(mockSchema);

    expect(() => middleware(mockReq, mock<Response>(), next)).toThrow();
  });
});

describe("validateQuery", () => {
  const mockSchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

  const next: jest.MockedFunction<NextFunction> = jest.fn();

  afterEach(() => jest.clearAllMocks());

  it("should coerce and attaches parsed query to req.query", () => {
    const mockReq = mock<Request>({ query: { page: "2" } }); // string from URL, coerced to number

    const middleware = validateQuery(mockSchema);

    middleware(mockReq, mock<Response>(), next);

    expect(mockReq.query).toEqual({ page: 2 });
  });

  it("should apply default value when field is missing", () => {
    const mockReq = mock<Request>();

    // Object.defineProperty forces a genuinely plain empty object, matching what an unparsed
    // Express request with no query string actually looks like.
    Object.defineProperty(mockReq, "query", { value: {}, configurable: true });

    const middleware = validateQuery(mockSchema);

    middleware(mockReq, mock<Response>(), next);

    expect(mockReq.query).toEqual({ page: 1 });
  });
});
