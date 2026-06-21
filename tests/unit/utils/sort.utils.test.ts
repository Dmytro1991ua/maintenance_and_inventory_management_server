import { resolveSortField } from "../../../src/utils";

describe("resolveSortField", () => {
  const allowedFields = ["createdAt", "name", "email"] as const;
  const defaultField = "createdAt" as const;

  it("should return the requested field when it is in the allowed list", () => {
    expect(resolveSortField("name", allowedFields, defaultField)).toBe("name");
  });

  it("should return the default field when the requested field is not allowed", () => {
    expect(resolveSortField("password", allowedFields, defaultField)).toBe("createdAt");
  });

  it("should return the default field when the requested field is an empty string", () => {
    expect(resolveSortField("", allowedFields, defaultField)).toBe("createdAt");
  });

  it("should not match differently-cased allowed fields when case-sensitive", () => {
    expect(resolveSortField("Name", allowedFields, defaultField)).toBe("createdAt");
  });
});
