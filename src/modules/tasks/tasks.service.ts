import { ForbiddenError } from "../../errors";
import { Role } from "../../generated/prisma/client";
import { findOrThrow } from "../../utils";
import { usersRepository } from "../users/users.repository";
import { tasksRepository } from "./tasks.repository";
import type { CreateTask, TasksQuery, UpdateTask } from "./tasks.schemas";

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
      await findOrThrow(() => usersRepository.findById(assignedTo), "Assignee not found");
    }

    return tasksRepository.create(data);
  },
  //   ADMIN + MANAGER → can update any field (title, description, status, assignee)
  //   TECHNICIAN      → can only update status on tasks assigned to them
  update: async (id: string, data: UpdateTask, requestingUser: { id: string; roles: Role[] }) => {
    const task = await findOrThrow(() => tasksRepository.findById(id), "Task not found");

    const isAdminOrManager = requestingUser.roles.some(
      (role) => role === Role.ADMIN || role === Role.MANAGER,
    );

    // ADMIN / MANAGER → full access
    if (isAdminOrManager) {
      const { assignedTo } = data;

      if (assignedTo) {
        await findOrThrow(() => usersRepository.findById(assignedTo), "Assignee not found");
      }

      return tasksRepository.update(id, data);
    }

    // Technician must own the task
    if (task.assignedTo !== requestingUser.id) {
      throw new ForbiddenError("You can only update tasks assigned to you");
    }

    // Technician must only send status — nothing else
    const keys = Object.keys(data);

    const isOnlyStatusUpdate = keys.length === 1 && keys[0] === "status";

    if (!isOnlyStatusUpdate) {
      throw new ForbiddenError("Technicians can only update task status");
    }

    return tasksRepository.update(id, data);
  },
  delete: async (id: string): Promise<void> => {
    await findOrThrow(() => tasksRepository.findById(id), "Task not found");

    await tasksRepository.delete(id);
  },
};
