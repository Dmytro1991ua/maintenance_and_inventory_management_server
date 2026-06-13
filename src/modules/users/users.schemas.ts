import { z } from "zod";

export const UsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    role: z.enum(["ADMIN", "MANAGER", "TECHNICIAN"]).optional().openapi({ example: "TECHNICIAN" }),
    sortBy: z.enum(["createdAt", "userName", "email"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .openapi("UsersQuery");

export const UpdateUserSchema = z
  .object({
    userName: z
      .string()
      .min(3, { error: "Username must be at least 3 characters" })
      .max(30, { error: "Username must be at most 30 characters" })
      .regex(/^[a-zA-Z0-9_]+$/, {
        error: "Username can only contain letters, numbers and underscores",
      })
      .optional()
      .openapi({ example: "johndoe2" }),
    email: z
      .email({ error: "Invalid email address" })
      .optional()
      .openapi({ example: "newemail@example.com" }),
  })
  .strict()
  .openapi("UpdateUserInput");

export const UpdateRolesSchema = z
  .object({
    roles: z
      .array(z.enum(["ADMIN", "MANAGER", "TECHNICIAN"]))
      .min(1, { error: "At least one role is required" })
      .openapi({ example: ["MANAGER"] }),
  })
  .strict()
  .openapi("UpdateRolesInput");

export const UserIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid user ID" }),
});

// — Response schemas — documentation only ——————————————————————————————————

export const UserSchema = z
  .object({
    id: z.uuid(),
    userName: z.string().openapi({ example: "johndoe" }),
    email: z.string().openapi({ example: "john@example.com" }),
    roles: z.array(z.enum(["ADMIN", "MANAGER", "TECHNICIAN"])),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("User");

export const UserResponseSchema = z
  .object({
    success: z.literal(true),
    data: UserSchema,
  })
  .openapi("UserResponse");

export const UsersListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(UserSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("UsersListResponse");

export type UsersQuery = z.infer<typeof UsersQuerySchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type UpdateRoles = z.infer<typeof UpdateRolesSchema>;
export type UserIdParam = z.infer<typeof UserIdParamSchema>;
