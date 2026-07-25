import { prisma } from "../../config";
import { Role, UserInvite } from "../../generated/prisma/client";

export const invitesRepository = {
  create: (data: { email: string; role: Role; expiresAt: Date }): Promise<UserInvite> => {
    return prisma.userInvite.create({ data });
  },

  findByToken: (token: string): Promise<UserInvite | null> => {
    return prisma.userInvite.findUnique({ where: { token } });
  },

  markUsed: (id: string): Promise<UserInvite> => {
    return prisma.userInvite.update({ where: { id }, data: { usedAt: new Date() } });
  },

  findPending: () => {
    return prisma.userInvite.findMany({
      where: { usedAt: null },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },
};
