import { getSkipValue, getTotalPages } from "../../../src/utils";

describe("getSkipValue", () => {
  it("should return 0 for page 1", () => {
    expect(getSkipValue(1, 20)).toBe(0);
  });

  it("should calculate correct skip for page 3, limit 20", () => {
    expect(getSkipValue(3, 20)).toBe(40);
  });

  it("should calculate correct skip for page 5, limit 10", () => {
    expect(getSkipValue(5, 10)).toBe(40);
  });
});

describe("getTotalPages", () => {
  it("should round up when total is not evenly divisible by limit", () => {
    expect(getTotalPages(95, 20)).toBe(5);
  });

  it("should return exact pages when evenly divisible", () => {
    expect(getTotalPages(100, 20)).toBe(5);
  });

  it("should return 0 when total is 0", () => {
    expect(getTotalPages(0, 20)).toBe(0);
  });

  it("should return 0 when limit is 0 (guards against division by zero)", () => {
    expect(getTotalPages(100, 0)).toBe(0);
  });

  it("should return 0 when limit is negative", () => {
    expect(getTotalPages(100, -5)).toBe(0);
  });
});
