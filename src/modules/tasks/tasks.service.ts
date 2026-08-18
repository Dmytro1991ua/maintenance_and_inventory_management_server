import { logger } from "../../config";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { Role } from "../../generated/prisma/client";
import { emailService } from "../../shared/email.service";
import { storageService } from "../../shared/storage.service";
import { ensureOwner, findOrThrow } from "../../utils";
import { checklistTemplatesRepository } from "../checklist-templates/checklist-templates.repository";
import { inventoryRepository } from "../inventory/inventory.repository";
import { usersRepository } from "../users/users.repository";
import { ASSIGNEE_NOT_FOUND_MESSAGE } from "./tasks.constants";
import { tasksRepository } from "./tasks.repository";
import type { CompleteTask, CreateTask, TasksQuery, UpdateTask } from "./tasks.schemas";

const assertAssigneeAvailable = async (userId: string, excludeTaskId?: string): Promise<void> => {
  const activeTask = await tasksRepository.findActiveForUser(userId, excludeTaskId);

  if (activeTask) {
    throw new ConflictError("Technician already has an active task and is not available");
  }
};

const resolveTaskForCaller = async (
  id: string,
  requestingUser: { id: string; roles: Role[] },
  forbiddenMessage: string,
) => {
  const task = await findOrThrow(() => tasksRepository.findById(id), "Task not found");

  const isAdminOrManager = requestingUser.roles.some((r) => r === Role.ADMIN || r === Role.MANAGER);

  if (!isAdminOrManager) {
    ensureOwner(task.assignedTo ?? "", requestingUser.id, forbiddenMessage);
  }

  return task;
};

const makeUploadPhotoService =
  (type: "before" | "after") =>
  async (id: string, requestingUser: { id: string; roles: Role[] }, file: Express.Multer.File) => {
    await resolveTaskForCaller(
      id,
      requestingUser,
      "You can only upload photos for tasks assigned to you",
    );

    const url = await storageService.uploadTaskPhoto(id, type, file.buffer, file.mimetype);

    return type === "before"
      ? tasksRepository.setBeforePhoto(id, url)
      : tasksRepository.setAfterPhoto(id, url);
  };

export const tasksService = {
  findAll: async (query: TasksQuery) => {
    return tasksRepository.findAll(query);
  },
  findById: async (id: string) => {
    return findOrThrow(() => tasksRepository.findById(id), "Task not found");
  },
  // ADMIN + MANAGER only — enforced at route level
  create: async (data: CreateTask) => {
    // assignedTo is a foreign key — a syntactically valid but nonexistent user
    // ID would otherwise hit Postgres as a raw FK violation (P2003) and
    // surface as an unhandled 500. Verify existence so it 404s cleanly instead.
    const { assignedTo } = data;

    if (assignedTo) {
      await findOrThrow(() => usersRepository.findById(assignedTo), ASSIGNEE_NOT_FOUND_MESSAGE);

      await assertAssigneeAvailable(assignedTo);
    }

    const task = await tasksRepository.create(data);

    if (task.assignee) {
      emailService
        .sendTaskAssignment(task.assignee.email, {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
        })
        .catch((err) => logger.warn({ err }, "Failed to send task assignment email"));
    }

    return task;
  },
  //   ADMIN + MANAGER → can update any field (title, description, status, assignee)
  //   TECHNICIAN      → can only update status on tasks assigned to them
  update: async (id: string, data: UpdateTask, requestingUser: { id: string; roles: Role[] }) => {
    const task = await findOrThrow(() => tasksRepository.findById(id), "Task not found");

    // DONE is a terminal state reachable only via POST /tasks/:id/complete,
    // which validates after photo, checklist, and inventory before marking DONE.
    if (data.status === "DONE") {
      throw new BadRequestError("Use POST /tasks/:id/complete to mark a task as done");
    }

    const isAdminOrManager = requestingUser.roles.some(
      (role) => role === Role.ADMIN || role === Role.MANAGER,
    );

    // ADMIN / MANAGER → full access
    if (isAdminOrManager) {
      const { assignedTo } = data;

      if (assignedTo) {
        await findOrThrow(() => usersRepository.findById(assignedTo), ASSIGNEE_NOT_FOUND_MESSAGE);

        if (assignedTo !== task.assignedTo) {
          await assertAssigneeAvailable(assignedTo, id);
        }
      }

      const updatedTask = await tasksRepository.update(id, data);

      if (data.assignedTo && data.assignedTo !== task.assignedTo && updatedTask.assignee) {
        emailService
          .sendTaskAssignment(updatedTask.assignee.email, {
            id: updatedTask.id,
            title: updatedTask.title,
            dueDate: updatedTask.dueDate,
          })
          .catch((err) => logger.warn({ err }, "Failed to send task assignment email"));
      }

      return updatedTask;
    }

    // Technician must own the task
    ensureOwner(
      task.assignedTo ?? "",
      requestingUser.id,
      "You can only update tasks assigned to you",
    );

    // Technician must only send status — nothing else
    const keys = Object.keys(data);

    const isOnlyStatusUpdate = keys.length === 1 && keys[0] === "status";

    if (!isOnlyStatusUpdate) {
      throw new ForbiddenError("Technicians can only update task status");
    }

    return tasksRepository.update(id, data);
  },
  uploadBeforePhoto: makeUploadPhotoService("before"),
  uploadAfterPhoto: makeUploadPhotoService("after"),
  complete: async (
    id: string,
    requestingUser: { id: string; roles: Role[] },
    data: CompleteTask,
  ) => {
    const task = await resolveTaskForCaller(
      id,
      requestingUser,
      "You can only complete tasks assigned to you",
    );

    if (task.status === "DONE") {
      throw new ConflictError("Task is already completed");
    }

    if (!task.afterPhotoUrl) {
      throw new BadRequestError("After photo is required before completing the task");
    }

    // Validate checklist against template if task has a category
    if (task.category) {
      const template = await checklistTemplatesRepository.findByCategory(task.category);

      if (template && template.items.length > 0) {
        const checkedSet = new Set(data.checklist);

        const missing = template.items.filter((item) => !checkedSet.has(item));

        if (missing.length > 0) {
          throw new BadRequestError(`Checklist incomplete. Missing: ${missing.join(", ")}`);
        }
      }
    }

    // Validate parts: exist and have sufficient stock
    if (data.partsUsed.length > 0) {
      await Promise.all(
        data.partsUsed.map(async ({ inventoryItemId, quantity }) => {
          const item = await inventoryRepository.findById(inventoryItemId);

          if (!item) {
            throw new NotFoundError(`Inventory item ${inventoryItemId} not found`);
          }

          if (item.quantity < quantity) {
            throw new ConflictError(
              `Insufficient stock for "${item.name}": requested ${quantity}, available ${item.quantity}`,
            );
          }
        }),
      );
    }

    return tasksRepository.complete(id, data);
  },
  delete: async (id: string): Promise<void> => {
    const task = await findOrThrow(() => tasksRepository.findById(id), "Task not found");

    const photosToDelete = [task.beforePhotoUrl, task.afterPhotoUrl].filter(Boolean) as string[];

    await Promise.all(
      photosToDelete.map((url) =>
        storageService
          .deleteTaskPhoto(url)
          .catch((err) => logger.warn({ err }, "Failed to delete task photo from storage")),
      ),
    );

    await tasksRepository.delete(id);
  },
};
