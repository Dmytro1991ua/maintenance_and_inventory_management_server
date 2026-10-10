import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CreateMeterSchema,
  MeterIdParamSchema,
  MeterResponseSchema,
  MetersListResponseSchema,
  MetersQuerySchema,
  ReadingsListResponseSchema,
  ReadingsQuerySchema,
  RecordReadingResponseSchema,
  RecordReadingSchema,
  UpdateMeterSchema,
} from "./meters.schemas";

const bearerAuth = [{ bearerAuth: [] }];

const err = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorResponseSchema } },
});

const forbidden = err("ADMIN or MANAGER role required");
const notFound = err("Meter not found");

registry.registerPath({
  method: "get",
  path: "/meters",
  description: "List meters. Paginated; filter by `assetId`.",
  tags: ["Meters"],
  security: bearerAuth,
  request: { query: MetersQuerySchema },
  responses: {
    200: {
      description: "Paginated list of meters",
      content: { "application/json": { schema: MetersListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/meters",
  description:
    "Add a meter (engine hours, odometer, cycles) to an asset. ADMIN/MANAGER only. The `initialReading` (default 0) is logged as the first reading.",
  tags: ["Meters"],
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: CreateMeterSchema } } } },
  responses: {
    201: {
      description: "Meter created",
      content: { "application/json": { schema: MeterResponseSchema } },
    },
    403: forbidden,
    404: err("Asset not found"),
    409: err("The asset already has a meter with that name"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/meters/{id}",
  description: "Rename a meter. ADMIN/MANAGER only. The unit can't be changed.",
  tags: ["Meters"],
  security: bearerAuth,
  request: {
    params: MeterIdParamSchema,
    body: { content: { "application/json": { schema: UpdateMeterSchema } } },
  },
  responses: {
    200: {
      description: "Meter renamed",
      content: { "application/json": { schema: MeterResponseSchema } },
    },
    403: forbidden,
    404: notFound,
    409: err("The asset already has a meter with that name"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/meters/{id}",
  description: "Delete a meter and its reading history. ADMIN/MANAGER only.",
  tags: ["Meters"],
  security: bearerAuth,
  request: { params: MeterIdParamSchema },
  responses: { 204: { description: "Meter deleted" }, 403: forbidden, 404: notFound },
});

registry.registerPath({
  method: "get",
  path: "/meters/{id}/readings",
  description: "Reading history for a meter, newest first. Paginated.",
  tags: ["Meters"],
  security: bearerAuth,
  request: { params: MeterIdParamSchema, query: ReadingsQuerySchema },
  responses: {
    200: {
      description: "Paginated reading history",
      content: { "application/json": { schema: ReadingsListResponseSchema } },
    },
    404: notFound,
  },
});

registry.registerPath({
  method: "post",
  path: "/meters/{id}/readings",
  description:
    "Record a reading. Any authenticated role. The time is set by the server. A reading lower than the current one is rejected; an equal one is accepted.",
  tags: ["Meters"],
  security: bearerAuth,
  request: {
    params: MeterIdParamSchema,
    body: { content: { "application/json": { schema: RecordReadingSchema } } },
  },
  responses: {
    201: {
      description: "Reading recorded; returns the reading and the updated meter",
      content: { "application/json": { schema: RecordReadingResponseSchema } },
    },
    404: notFound,
    409: err("Reading is lower than the current reading"),
  },
});
