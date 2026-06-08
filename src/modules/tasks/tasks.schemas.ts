import { z } from "zod";

export const TasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "status", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
  assignedTo: z.uuid().optional(),
});

export const CreateTaskSchema = z
  .object({
    title: z.string().min(1, { error: "Title is required" }).max(200),
    description: z.string().max(2000).optional(),
    assignedTo: z.uuid({ error: "Invalid user ID" }).optional(),
  })
  .strict();

export const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
    assignedTo: z.uuid({ error: "Invalid user ID" }).nullable().optional(),
  })
  .strict();

export const TaskIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid task ID" }),
});

export type TasksQuery = z.infer<typeof TasksQuerySchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
export type TaskIdParam = z.infer<typeof TaskIdParamSchema>;
