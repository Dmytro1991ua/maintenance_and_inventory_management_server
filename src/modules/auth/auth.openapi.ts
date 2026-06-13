import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  LoginResponseSchema,
  LoginSchema,
  RegisterResponseSchema,
  RegisterSchema,
} from "./auth.schemas";

registry.registerPath({
  method: "post",
  path: "/auth/register",
  description:
    "Create a new user account. New accounts always receive the TECHNICIAN role — role assignment requires an ADMIN via PATCH /users/:id/roles.",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: RegisterSchema } } },
  },
  responses: {
    201: {
      description: "User created",
      content: { "application/json": { schema: RegisterResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Email or username already in use",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: { description: "Too many attempts — rate limited" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  description:
    "Authenticate with email and password. Returns an access token in the response body and sets a refresh token as an HttpOnly cookie.",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: LoginSchema } } },
  },
  responses: {
    200: {
      description: "Login successful",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    401: {
      description: "Invalid credentials",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: { description: "Too many attempts — rate limited" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  description:
    "Rotates the refresh token. Reads the refresh token from the HttpOnly cookie, issues a new access token + refresh token pair. If the incoming token was already used (reuse detected), all sessions for the user are revoked.",
  tags: ["Auth"],
  responses: {
    200: {
      description: "Token refreshed",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    401: {
      description: "Missing, invalid, expired, or reused refresh token",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  description:
    "Clears the refresh token cookie and removes the session from Redis. Always returns 204, even if no valid session exists.",
  tags: ["Auth"],
  responses: {
    204: { description: "Logged out" },
  },
});
