import { prisma } from "../../config";
import { User } from "../../generated/prisma/client";
import { RegisterInput } from "./auth.schemas";

/**
 * Pure DB layer — no business logic, no error handling beyond what Prisma throws.
 * Service layer catches and interprets DB errors.
 */
export const authRepository = {
  findByEmail: (email: string): Promise<User | null> => {
    return prisma.user.findUnique({ where: { email } });
  },

  findById: (id: string): Promise<User | null> => {
    return prisma.user.findUnique({ where: { id } });
  },

  findByUserName: (userName: string): Promise<User | null> => {
    return prisma.user.findUnique({ where: { userName } });
  },

  create: (data: RegisterInput): Promise<User> => {
    return prisma.user.create({
      data: {
        userName: data.userName,
        email: data.email,
        password: data.password,
        // Role is never taken from the request — clients must not be able to
        // self-assign privileges. Admins assign roles via a dedicated endpoint.
        roles: ["TECHNICIAN"],
      },
    });
  },
};
