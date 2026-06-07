import { z } from "zod";

export const UsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["ADMIN", "MANAGER", "TECHNICIAN"]).optional(),
  sortBy: z.enum(["createdAt", "userName", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const UpdateUserSchema = z.object({
  userName: z
    .string()
    .min(3, { error: "Username must be at least 3 characters" })
    .max(30, { error: "Username must be at most 30 characters" })
    .regex(/^[a-zA-Z0-9_]+$/, {
      error: "Username can only contain letters, numbers and underscores",
    })
    .optional(),
  email: z.email({ error: "Invalid email address" }).optional(),
});

export const UpdateRolesSchema = z.object({
  roles: z
    .array(z.enum(["ADMIN", "MANAGER", "TECHNICIAN"]))
    .min(1, { error: "At least one role is required" }),
});

export const UserIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid user ID" }),
});

export type UsersQuery = z.infer<typeof UsersQuerySchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type UpdateRoles = z.infer<typeof UpdateRolesSchema>;
export type UserIdParam = z.infer<typeof UserIdParamSchema>;
