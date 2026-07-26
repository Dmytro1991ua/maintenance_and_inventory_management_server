import { z } from "zod";

export const InviteUserSchema = z
  .object({
    email: z.email({ error: "Invalid email address" }).openapi({ example: "jane@example.com" }),
    // ADMIN role is intentionally excluded — admin access is granted only via
    // PATCH /users/:id/roles after a user has joined.
    role: z.enum(["MANAGER", "TECHNICIAN"]).openapi({ example: "TECHNICIAN" }),
  })
  .strict()
  .openapi("InviteUserInput");

// — Response schemas — documentation only ——————————————————————————————————

export const InviteResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.uuid(),
      email: z.string(),
      role: z.enum(["MANAGER", "TECHNICIAN"]),
      expiresAt: z.iso.datetime(),
    }),
  })
  .openapi("InviteResponse");

export const PendingInviteSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    role: z.enum(["ADMIN", "MANAGER", "TECHNICIAN"]),
    expiresAt: z.iso.datetime(),
    isExpired: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .openapi("PendingInvite");

export const PendingInvitesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(PendingInviteSchema),
  })
  .openapi("PendingInvitesResponse");

export const InviteIdParamSchema = z.object({ id: z.uuid() });

export type InviteUserInput = z.infer<typeof InviteUserSchema>;
