import { getLogLevel } from "../../../src/utils";

describe("getLogLevel", () => {
  it("should return 'error' for 5xx status codes", () => {
    expect(getLogLevel(500)).toBe("error");
    expect(getLogLevel(503)).toBe("error");
  });

  it("should return 'warn' for 4xx status codes", () => {
    expect(getLogLevel(400)).toBe("warn");
    expect(getLogLevel(404)).toBe("warn");
  });

  it("should return 'info' for status codes below 400", () => {
    expect(getLogLevel(200)).toBe("info");
    expect(getLogLevel(301)).toBe("info");
  });

  it("should return 'warn' at the exact 400 boundary, not 'info'", () => {
    expect(getLogLevel(399)).toBe("info");
    expect(getLogLevel(400)).toBe("warn");
  });

  it("should return 'error' at the exact 500 boundary, not 'warn'", () => {
    expect(getLogLevel(499)).toBe("warn");
    expect(getLogLevel(500)).toBe("error");
  });
});
