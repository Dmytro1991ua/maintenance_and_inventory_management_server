import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  AcceptInviteSchema,
  ForgotPasswordSchema,
  LoginResponseSchema,
  LoginSchema,
  RegisterResponseSchema,
  RegisterSchema,
  ResetPasswordSchema,
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

registry.registerPath({
  method: "post",
  path: "/auth/forgot-password",
  description:
    "Request a password reset email. Always returns 204 regardless of whether the email exists — prevents user enumeration. The email contains a single-use link that expires in 1 hour.",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: ForgotPasswordSchema } } },
  },
  responses: {
    204: {
      description: "Request received — if the email is registered, a reset link has been sent",
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: { description: "Too many attempts — rate limited" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  description:
    "Reset the password using the token from the reset email. The token is single-use and expires in 1 hour. On success, all active sessions are revoked and the user must log in again.",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: ResetPasswordSchema } } },
  },
  responses: {
    204: { description: "Password updated — all sessions revoked" },
    400: {
      description: "Token invalid, expired, or password does not meet requirements",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: { description: "Too many attempts — rate limited" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/accept-invite",
  description:
    "Accept an invite and create your account. The invite token (from the email link) pre-assigns your role. Supply your chosen username and password.",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: AcceptInviteSchema } } },
  },
  responses: {
    201: {
      description: "Account created",
      content: { "application/json": { schema: RegisterResponseSchema } },
    },
    400: {
      description: "Invite expired or already used",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Invite not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Username already taken",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
