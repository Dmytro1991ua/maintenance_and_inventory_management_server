import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Adds .openapi() to all Zod schemas. Must run before any schema file
// is imported anywhere in the app — imported first in app.ts for this reason.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

export const ErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: "VALIDATION_ERROR" }),
      message: z.string().openapi({ example: "Validation failed" }),
      fields: z.record(z.string(), z.array(z.string())).optional(),
    }),
  })
  .openapi("ErrorResponse");

export const generateOpenApiDocument = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Maintenance & Inventory Management API",
      version: "1.0.0",
      description:
        "REST API for managing equipment, inventory, maintenance tasks, and notifications.",
    },
    servers: [{ url: "/api/v1" }],
    tags: [
      { name: "Auth", description: "Registration, login, token rotation" },
      { name: "Users", description: "User profiles and role management" },
      { name: "Inventory", description: "Equipment and stock management" },
      { name: "Tasks", description: "Maintenance task assignment and tracking" },
      { name: "Notifications", description: "User notifications" },
    ],
  });
};
