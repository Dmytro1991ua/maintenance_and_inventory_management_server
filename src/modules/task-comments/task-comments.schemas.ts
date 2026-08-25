import { z } from "zod";

export const TaskCommentTaskParamSchema = z.object({
  id: z.uuid({ error: "Invalid task ID" }),
});

export const TaskCommentParamsSchema = z.object({
  id: z.uuid({ error: "Invalid task ID" }),
  commentId: z.uuid({ error: "Invalid comment ID" }),
});

export const CreateTaskCommentSchema = z
  .object({
    body: z
      .string()
      .min(1, { error: "Comment body is required" })
      .max(2000)
      .openapi({ example: "Found worn bearings at joint 3. Need replacement part #B-204." }),
  })
  .strict()
  .openapi("CreateTaskCommentInput");

export const TaskCommentSchema = z
  .object({
    id: z.uuid(),
    taskId: z.uuid(),
    body: z.string(),
    author: z.object({
      id: z.uuid(),
      userName: z.string(),
      email: z.string(),
    }),
    createdAt: z.iso.datetime(),
  })
  .openapi("TaskComment");

export const TaskCommentResponseSchema = z
  .object({
    success: z.literal(true),
    data: TaskCommentSchema,
  })
  .openapi("TaskCommentResponse");

export const TaskCommentsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TaskCommentSchema),
  })
  .openapi("TaskCommentsListResponse");

export type TaskCommentTaskParam = z.infer<typeof TaskCommentTaskParamSchema>;
export type TaskCommentParams = z.infer<typeof TaskCommentParamsSchema>;
export type CreateTaskComment = z.infer<typeof CreateTaskCommentSchema>;
