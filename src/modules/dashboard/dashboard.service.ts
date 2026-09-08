import { Role } from "../../generated/prisma/client";
import { isAdminOrManager } from "../../utils";
import { dashboardRepository } from "./dashboard.repository";

export const dashboardService = {
  getStats: async (requestingUser: { id: string; roles: Role[] }) => {
    if (isAdminOrManager(requestingUser.roles)) {
      return dashboardRepository.getManagerStats();
    }

    return dashboardRepository.getTechnicianStats(requestingUser.id);
  },
};
