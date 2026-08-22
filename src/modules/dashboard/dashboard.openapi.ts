import { registry } from "../../config/openapi";
import { DashboardStatsResponseSchema } from "./dashboard.schemas";

registry.registerPath({
  method: "get",
  path: "/dashboard/stats",
  description:
    "Returns dashboard statistics. ADMIN/MANAGER receive full stats (all tasks, inventory health, technician workloads, schedule summary). TECHNICIAN receives their own task breakdown only.",
  tags: ["Dashboard"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Dashboard stats",
      content: { "application/json": { schema: DashboardStatsResponseSchema } },
    },
  },
});
