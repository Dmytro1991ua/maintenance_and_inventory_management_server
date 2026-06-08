import { Prisma } from "../../generated/prisma/client";

// sortBy comes from the client — we whitelist allowed fields explicitly.
// Dynamic orderBy without a whitelist can expose unexpected DB behavior
// or break at runtime if the field doesn't exist on the model.
export const ALLOWED_USERS_ENTITY_SORT_FIELDS = ["createdAt", "userName", "email"] as const;

export const USER_ENTITY_DEFAULT_SORT_FIELD = "createdAt";

export const USER_SELECT = {
  id: true,
  userName: true,
  email: true,
  roles: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const USER_NOT_FOUND_MESSAGE = "User not found";
