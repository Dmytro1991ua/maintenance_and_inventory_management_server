import request from "supertest";

import app from "../../../src/app";

describe("security middleware", () => {
  describe("helmet", () => {
    it("should set secure headers on every response", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBeDefined();
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("cors", () => {
    it("should reflect an allowed origin in the response headers", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:3000");

      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("should not allow a disallowed origin", async () => {
      const response = await request(app).get("/health").set("Origin", "http://evil.example.com");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("body size limit", () => {
    it("should reject a JSON payload larger than 10kb", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          userName: "toolarge",
          email: "toolarge@example.com",
          password: "Password123",
          // Pad well past the 10kb limit
          padding: "x".repeat(15_000),
        });

      expect(response.status).toBe(413);
    });
  });
});
