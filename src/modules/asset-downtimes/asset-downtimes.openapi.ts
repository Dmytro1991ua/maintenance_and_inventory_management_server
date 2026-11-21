import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  DowntimeAssetParamSchema,
  DowntimeEventResponseSchema,
  DowntimeListResponseSchema,
  DowntimeParamsSchema,
  DowntimeQuerySchema,
  EndDowntimeSchema,
  StartDowntimeSchema,
} from "./asset-downtimes.schemas";

const bearerAuth = [{ bearerAuth: [] }];

const error = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorResponseSchema } },
});

registry.registerPath({
  method: "get",
  path: "/assets/{id}/downtime",
  description:
    "Downtime events that overlap the range (newest first) with a summary: downtime minutes (breakdown and planned), breakdown count, availability, MTTR (mean time to repair) and MTBF (mean time between breakdowns). Events count only the part inside the range, and an ongoing one counts up to now. MTTR and MTBF use breakdowns only; planned downtime lowers availability but is not a failure. A plain-date `to` includes that whole day. Defaults to the last 365 days.",
  tags: ["Asset Downtime"],
  security: bearerAuth,
  request: { params: DowntimeAssetParamSchema, query: DowntimeQuerySchema },
  responses: {
    200: {
      description: "Downtime events and summary",
      content: { "application/json": { schema: DowntimeListResponseSchema } },
    },
    400: error("Invalid range (`from` after `to`)"),
    404: error("Asset not found"),
  },
});

registry.registerPath({
  method: "post",
  path: "/assets/{id}/downtime",
  description:
    "Record that an asset went down, and mark it DOWN. `startedAt` defaults to now and may be backdated, but not before the asset's previous downtime ended. Any authenticated user can record it. The optional task must belong to this asset.",
  tags: ["Asset Downtime"],
  security: bearerAuth,
  request: {
    params: DowntimeAssetParamSchema,
    body: { content: { "application/json": { schema: StartDowntimeSchema } } },
  },
  responses: {
    201: {
      description: "Downtime started",
      content: { "application/json": { schema: DowntimeEventResponseSchema } },
    },
    400: error("Start in the future, or the task belongs to another asset"),
    404: error("Asset or task not found"),
    409: error("Already down, retired, or overlaps previous downtime"),
  },
});

registry.registerPath({
  method: "post",
  path: "/assets/{id}/downtime/{downtimeId}/end",
  description:
    "Record that an asset is back in service, and mark it OPERATIONAL. `endedAt` defaults to now; it must be after the start and not in the future.",
  tags: ["Asset Downtime"],
  security: bearerAuth,
  request: {
    params: DowntimeParamsSchema,
    body: { content: { "application/json": { schema: EndDowntimeSchema } } },
  },
  responses: {
    200: {
      description: "Downtime ended",
      content: { "application/json": { schema: DowntimeEventResponseSchema } },
    },
    400: error("End not after start, or in the future"),
    404: error("Event not found, or it does not belong to this asset"),
    409: error("Already ended"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/assets/{id}/downtime/{downtimeId}",
  description:
    "Delete a downtime event, for a mistaken entry. Deleting an ongoing event puts the asset back to OPERATIONAL. ADMIN and MANAGER only.",
  tags: ["Asset Downtime"],
  security: bearerAuth,
  request: { params: DowntimeParamsSchema },
  responses: {
    204: { description: "Deleted" },
    403: error("ADMIN or MANAGER role required"),
    404: error("Event not found, or it does not belong to this asset"),
  },
});
