import { z } from "zod";

export const RegisterSchema = z
  .object({
    userName: z
      .string()
      .min(3, { error: "Username must be at least 3 characters" })
      .max(30, { error: "Username must be at most 30 characters" })
      .regex(/^[a-zA-Z0-9_]+$/, {
        error: "Username can only contain letters, numbers and underscores",
      })
      .openapi({ example: "johndoe" }),
    email: z.email({ error: "Invalid email address" }).openapi({ example: "john@example.com" }),
    password: z
      .string()
      .min(8, { error: "Password must be at least 8 characters" })
      .max(64, { error: "Password must be at most 64 characters" })
      .regex(/[A-Z]/, { error: "Password must contain at least one uppercase letter" })
      .regex(/[0-9]/, { error: "Password must contain at least one number" })
      .openapi({ example: "Password123" }),
  })
  .openapi("RegisterInput");

export const LoginSchema = z
  .object({
    email: z.email({ error: "Invalid email address" }).openapi({ example: "john@example.com" }),
    password: z
      .string()
      .min(1, { error: "Password is required" })
      .openapi({ example: "Password123" }),
  })
  .openapi("LoginInput");

//Response schemas — documentation only

export const RegisterResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.uuid(),
      userName: z.string(),
      email: z.string(),
    }),
  })
  .openapi("RegisterResponse");

export const LoginResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      accessToken: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIs..." }),
      roles: z.array(z.enum(["ADMIN", "MANAGER", "TECHNICIAN"])),
    }),
  })
  .openapi("LoginResponse");

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
