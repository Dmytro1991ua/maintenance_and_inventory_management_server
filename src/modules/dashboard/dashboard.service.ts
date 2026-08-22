import { Role } from "../../generated/prisma/client";
import { dashboardRepository } from "./dashboard.repository";

export const dashboardService = {
  getStats: async (requestingUser: { id: string; roles: Role[] }) => {
    const isAdminOrManager = requestingUser.roles.some(
      (r) => r === Role.ADMIN || r === Role.MANAGER,
    );

    if (isAdminOrManager) {
      return dashboardRepository.getManagerStats();
    }

    return dashboardRepository.getTechnicianStats(requestingUser.id);
  },
};
