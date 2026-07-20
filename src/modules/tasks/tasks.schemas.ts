import { z } from "zod";

export const TasksQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    sortBy: z.enum(["createdAt", "status", "title"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().optional().openapi({ example: "HVAC" }),
    status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional().openapi({ example: "OPEN" }),
    assignedTo: z.uuid().optional().openapi({ example: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }),
    overdue: z.stringbool().optional().openapi({ example: true }),
    dueDateFrom: z.coerce.date().optional().openapi({ example: "2026-07-21T00:00:00.000Z" }),
    dueDateTo: z.coerce.date().optional().openapi({ example: "2026-07-27T23:59:59.999Z" }),
  })
  .openapi("TasksQuery");

export const CreateTaskSchema = z
  .object({
    title: z
      .string()
      .min(1, { error: "Title is required" })
      .max(200)
      .openapi({ example: "Replace HVAC filter — Building A" }),
    description: z
      .string()
      .max(2000)
      .optional()
      .openapi({ example: "Filter is overdue for replacement." }),
    assignedTo: z
      .uuid({ error: "Invalid user ID" })
      .optional()
      .openapi({ example: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }),
    dueDate: z.coerce.date().optional().openapi({ example: "2026-07-01T00:00:00.000Z" }),
  })
  .strict()
  .openapi("CreateTaskInput");

export const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional().openapi({ example: "IN_PROGRESS" }),
    assignedTo: z.uuid({ error: "Invalid user ID" }).nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .strict()
  .openapi("UpdateTaskInput");

export const TaskIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid task ID" }),
});

// — Response schemas — documentation only ——————————————————————————————————

export const TaskSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]),
    assignedTo: z.uuid().nullable(),
    assignee: z
      .object({
        id: z.uuid(),
        userName: z.string(),
        email: z.string(),
      })
      .nullable(),
    dueDate: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Task");

export const TaskResponseSchema = z
  .object({
    success: z.literal(true),
    data: TaskSchema,
  })
  .openapi("TaskResponse");

export const TasksListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TaskSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("TasksListResponse");

export type TasksQuery = z.infer<typeof TasksQuerySchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
export type TaskIdParam = z.infer<typeof TaskIdParamSchema>;
