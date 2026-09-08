import { prisma } from "../../config";
import { Prisma } from "../../generated/prisma/client";
import { getSkipValue, getTotalPages, resolveSortField } from "../../utils";
import {
  WORK_ORDER_REQUEST_ENTITY_ALLOWED_SORT_FIELDS,
  WORK_ORDER_REQUEST_ENTITY_DEFAULT_SORT_FIELD,
  WORK_ORDER_REQUEST_SELECT,
} from "./work-order-requests.constants";
import type { CreateWorkOrderRequest, WorkOrderRequestsQuery } from "./work-order-requests.schemas";

// `requestedBy` scopes the list to a single requester (non-managers see only
// their own); omitted for ADMIN/MANAGER, who see the whole triage queue.
type FindAllOptions = { query: WorkOrderRequestsQuery; requestedBy?: string };

const buildWhere = (
  search: string | undefined,
  status: WorkOrderRequestsQuery["status"],
  requestedBy?: string,
): Prisma.WorkOrderRequestWhereInput | undefined => {
  const normalizedSearch = search?.trim() || undefined;

  if (!normalizedSearch && !status && !requestedBy) return undefined;

  return {
    ...(status && { status }),
    ...(requestedBy && { requestedBy }),
    ...(normalizedSearch && {
      OR: [
        { title: { contains: normalizedSearch, mode: "insensitive" } },
        { description: { contains: normalizedSearch, mode: "insensitive" } },
      ],
    }),
  };
};

export const workOrderRequestsRepository = {
  findAll: async ({ query, requestedBy }: FindAllOptions) => {
    const { page, limit, sortBy, sortOrder, search, status } = query;

    const field = resolveSortField(
      sortBy,
      WORK_ORDER_REQUEST_ENTITY_ALLOWED_SORT_FIELDS,
      WORK_ORDER_REQUEST_ENTITY_DEFAULT_SORT_FIELD,
    );
    const skip = getSkipValue(page, limit);
    const where = buildWhere(search, status, requestedBy);

    const [total, data] = await Promise.all([
      prisma.workOrderRequest.count({ where }),
      prisma.workOrderRequest.findMany({
        where,
        select: WORK_ORDER_REQUEST_SELECT,
        orderBy: { [field]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, pages: getTotalPages(total, limit) } };
  },

  findById: (id: string) =>
    prisma.workOrderRequest.findUnique({ where: { id }, select: WORK_ORDER_REQUEST_SELECT }),

  create: (data: CreateWorkOrderRequest, requestedBy: string) =>
    prisma.workOrderRequest.create({
      data: { ...data, requestedBy },
      select: WORK_ORDER_REQUEST_SELECT,
    }),

  approve: (id: string, { taskId, reviewedBy }: { taskId: string; reviewedBy: string }) =>
    prisma.workOrderRequest.update({
      where: { id },
      data: { status: "APPROVED", taskId, reviewedBy, reviewedAt: new Date() },
      select: WORK_ORDER_REQUEST_SELECT,
    }),

  reject: (id: string, { reason, reviewedBy }: { reason: string; reviewedBy: string }) =>
    prisma.workOrderRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedBy,
        reviewedAt: new Date(),
      },
      select: WORK_ORDER_REQUEST_SELECT,
    }),
};
