import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CreateTimeEntrySchema,
  TimeEntriesListResponseSchema,
  TimeEntryParamsSchema,
  TimeEntryResponseSchema,
  TimeEntryTaskParamSchema,
} from "./task-time-entries.schemas";

const bearerAuth = [{ bearerAuth: [] }];

const error = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorResponseSchema } },
});

registry.registerPath({
  method: "get",
  path: "/tasks/{id}/time-entries",
  description:
    "List a task's time entries, oldest work date first, with the total minutes. ADMIN and MANAGER also get each entry's rate and cost, the total cost, and the minutes with no rate (excluded from the total).",
  tags: ["Task Time Entries"],
  security: bearerAuth,
  request: { params: TimeEntryTaskParamSchema },
  responses: {
    200: {
      description: "Time entries and totals",
      content: { "application/json": { schema: TimeEntriesListResponseSchema } },
    },
    404: error("Task not found"),
  },
});

registry.registerPath({
  method: "post",
  path: "/tasks/{id}/time-entries",
  description:
    "Log time against a task, as the authenticated user. A technician can log only on tasks assigned to them; ADMIN and MANAGER on any task. The user's hourly rate is frozen on the entry. Not allowed on a cancelled task.",
  tags: ["Task Time Entries"],
  security: bearerAuth,
  request: {
    params: TimeEntryTaskParamSchema,
    body: { content: { "application/json": { schema: CreateTimeEntrySchema } } },
  },
  responses: {
    201: {
      description: "Time entry created",
      content: { "application/json": { schema: TimeEntryResponseSchema } },
    },
    400: error("Work date is in the future"),
    403: error("Task is not assigned to you"),
    404: error("Task not found"),
    409: error("Task is cancelled"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/tasks/{id}/time-entries/{entryId}",
  description:
    "Delete a time entry. Authors can delete their own; ADMIN and MANAGER can delete any.",
  tags: ["Task Time Entries"],
  security: bearerAuth,
  request: { params: TimeEntryParamsSchema },
  responses: {
    204: { description: "Deleted" },
    403: error("Not your time entry"),
    404: error("Entry not found, or it does not belong to this task"),
  },
});
