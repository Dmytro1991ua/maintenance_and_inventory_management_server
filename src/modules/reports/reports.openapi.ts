import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  AssetReliabilityResponseSchema,
  ThroughputQuerySchema,
  ThroughputResponseSchema,
} from "./reports.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/reports/assets",
  description:
    "Lifetime reliability report, one row per asset: total/open/overdue/completed task counts, total parts consumed, and average completion time in days. Ordered by most-worked assets first. ADMIN/MANAGER only.",
  tags: ["Reports"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Per-asset reliability rows",
      content: { "application/json": { schema: AssetReliabilityResponseSchema } },
    },
    403: {
      description: "ADMIN or MANAGER role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/reports/throughput",
  description:
    "Maintenance throughput over time: tasks created vs completed per bucket (day/week/month), zero-filled across the range, plus a summary with completion rate and average cycle time. Defaults to the last 12 weeks. ADMIN/MANAGER only.",
  tags: ["Reports"],
  security: bearerAuth,
  request: { query: ThroughputQuerySchema },
  responses: {
    200: {
      description: "Throughput series and summary",
      content: { "application/json": { schema: ThroughputResponseSchema } },
    },
    400: {
      description: "Invalid range (`from` after `to`)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "ADMIN or MANAGER role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
