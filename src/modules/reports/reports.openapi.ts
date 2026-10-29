import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  AssetReliabilityResponseSchema,
  AssetReportQuerySchema,
  SpendQuerySchema,
  SpendResponseSchema,
  TechnicianWorkloadQuerySchema,
  TechnicianWorkloadResponseSchema,
  ThroughputQuerySchema,
  ThroughputResponseSchema,
} from "./reports.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/reports/assets",
  description:
    "Lifetime reliability report, one row per asset: total/open/overdue/completed task counts, total parts consumed, and average completion time in days. Paginated; searchable by name/serial/location; filterable by category and status; sortable by any computed metric (defaults to most-worked first). ADMIN/MANAGER only.",
  tags: ["Reports"],
  security: bearerAuth,
  request: { query: AssetReportQuerySchema },
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
  path: "/reports/technicians",
  description:
    "Current workload per technician: open/in-progress/overdue/completed task counts and the next upcoming due date. One row per technician (idle ones show zeros). Paginated; searchable by userName/email; sortable by any count, nextDueAt, or userName (defaults to busiest first). ADMIN/MANAGER only.",
  tags: ["Reports"],
  security: bearerAuth,
  request: { query: TechnicianWorkloadQuerySchema },
  responses: {
    200: {
      description: "Per-technician workload rows",
      content: { "application/json": { schema: TechnicianWorkloadResponseSchema } },
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
    "Maintenance throughput over time: tasks created vs completed per bucket (day/week/month), zero-filled across the range, plus a summary with completion rate and average cycle time. A plain-date `to` (2026-07-31) includes that whole day. Defaults to the last 12 weeks. ADMIN/MANAGER only.",
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

registry.registerPath({
  method: "get",
  path: "/reports/spend",
  description:
    "Purchasing spend: what was actually paid (quantity x received unit cost) for RECEIVED reorders whose receivedAt falls in the range. Returns a summary (spent, variance against the estimate, and how many received orders had no price recorded and are excluded from the totals), a zero-filled series per day/week/month, and breakdowns by supplier and by category (biggest first; supplier null = none set), using the supplier and category the item had when the order was received, so later edits to an item do not move past spend. A plain-date `to` (2026-07-31) includes that whole day. Defaults to the last 12 months by month. Money is a 2-decimal string. ADMIN/MANAGER only.",
  tags: ["Reports"],
  security: bearerAuth,
  request: { query: SpendQuerySchema },
  responses: {
    200: {
      description: "Spend summary, series and breakdowns",
      content: { "application/json": { schema: SpendResponseSchema } },
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
