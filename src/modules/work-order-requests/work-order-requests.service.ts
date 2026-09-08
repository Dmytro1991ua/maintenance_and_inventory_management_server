import { ConflictError, ForbiddenError } from "../../errors";
import { Role } from "../../generated/prisma/client";
import { findOrThrow, isAdminOrManager } from "../../utils";
import { assetsRepository } from "../assets/assets.repository";
import type { CreateTask } from "../tasks/tasks.schemas";
import { tasksService } from "../tasks/tasks.service";
import {
  ALREADY_REVIEWED_MESSAGE,
  WORK_ORDER_REQUEST_NOT_FOUND_MESSAGE,
} from "./work-order-requests.constants";
import { workOrderRequestsRepository } from "./work-order-requests.repository";
import type {
  ApproveWorkOrderRequest,
  CreateWorkOrderRequest,
  RejectWorkOrderRequest,
  WorkOrderRequestsQuery,
} from "./work-order-requests.schemas";

type RequestingUser = { id: string; roles: Role[] };

export const workOrderRequestsService = {
  create: async (data: CreateWorkOrderRequest, requestedBy: string) => {
    // assetId is an optional FK — verify existence so a bad id 404s cleanly
    // instead of surfacing as a raw Postgres FK violation.
    if (data.assetId) {
      await findOrThrow(() => assetsRepository.findById(data.assetId!), "Asset not found");
    }

    return workOrderRequestsRepository.create(data, requestedBy);
  },

  // ADMIN/MANAGER see the whole queue; everyone else sees only their own.
  findAll: async (query: WorkOrderRequestsQuery, requestingUser: RequestingUser) => {
    const requestedBy = isAdminOrManager(requestingUser.roles) ? undefined : requestingUser.id;

    return workOrderRequestsRepository.findAll({ query, requestedBy });
  },

  findById: async (id: string, requestingUser: RequestingUser) => {
    const request = await findOrThrow(
      () => workOrderRequestsRepository.findById(id),
      WORK_ORDER_REQUEST_NOT_FOUND_MESSAGE,
    );

    if (!isAdminOrManager(requestingUser.roles) && request.requestedBy !== requestingUser.id) {
      throw new ForbiddenError("You can only view your own work order requests");
    }

    return request;
  },

  // ADMIN/MANAGER only (enforced at route level). Spawns a real task from the
  // request via tasksService.create — inheriting its assignee/asset validation
  // and assignment email — then records the approval and links the task.
  approve: async (id: string, requestingUser: RequestingUser, body: ApproveWorkOrderRequest) => {
    const request = await findOrThrow(
      () => workOrderRequestsRepository.findById(id),
      WORK_ORDER_REQUEST_NOT_FOUND_MESSAGE,
    );

    if (request.status !== "PENDING") {
      throw new ConflictError(ALREADY_REVIEWED_MESSAGE);
    }

    const createTaskData: CreateTask = {
      title: request.title,
      priority: request.priority,
      ...(request.description != null && { description: request.description }),
      ...(request.category != null && { category: request.category }),
      ...(request.assetId != null && { assetId: request.assetId }),
      ...(body.assignedTo && { assignedTo: body.assignedTo }),
      ...(body.dueDate && { dueDate: body.dueDate }),
    };

    const task = await tasksService.create(createTaskData);

    return workOrderRequestsRepository.approve(id, {
      taskId: task.id,
      reviewedBy: requestingUser.id,
    });
  },

  reject: async (id: string, requestingUser: RequestingUser, body: RejectWorkOrderRequest) => {
    const request = await findOrThrow(
      () => workOrderRequestsRepository.findById(id),
      WORK_ORDER_REQUEST_NOT_FOUND_MESSAGE,
    );

    if (request.status !== "PENDING") {
      throw new ConflictError(ALREADY_REVIEWED_MESSAGE);
    }

    return workOrderRequestsRepository.reject(id, {
      reason: body.reason,
      reviewedBy: requestingUser.id,
    });
  },
};
