import { logger } from "../../config";
import { ConflictError, ForbiddenError } from "../../errors";
import { NotificationType, Role } from "../../generated/prisma/client";
import { findOrThrow, isAdminOrManager } from "../../utils";
import { assetsRepository } from "../assets/assets.repository";
import { notificationsService } from "../notifications/notifications.service";
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

const notifyRequester = async (
  requestedBy: string,
  requestId: string,
  type: NotificationType,
  message: string,
): Promise<void> => {
  try {
    await notificationsService.createMany(type, [
      { type, message, userId: requestedBy, relatedEntityId: requestId },
    ]);
  } catch (err) {
    logger.warn({ err, requestId }, "Failed to create work order request notification");
  }
};

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

    const updated = await workOrderRequestsRepository.approve(id, {
      taskId: task.id,
      reviewedBy: requestingUser.id,
    });

    await notifyRequester(
      request.requestedBy,
      request.id,
      NotificationType.WORK_ORDER_APPROVED,
      `Your work order request "${request.title}" was approved.`,
    );

    return updated;
  },

  reject: async (id: string, requestingUser: RequestingUser, body: RejectWorkOrderRequest) => {
    const request = await findOrThrow(
      () => workOrderRequestsRepository.findById(id),
      WORK_ORDER_REQUEST_NOT_FOUND_MESSAGE,
    );

    if (request.status !== "PENDING") {
      throw new ConflictError(ALREADY_REVIEWED_MESSAGE);
    }

    const updated = await workOrderRequestsRepository.reject(id, {
      reason: body.reason,
      reviewedBy: requestingUser.id,
    });

    await notifyRequester(
      request.requestedBy,
      request.id,
      NotificationType.WORK_ORDER_REJECTED,
      `Your work order request "${request.title}" was rejected: ${body.reason}`,
    );

    return updated;
  },
};
