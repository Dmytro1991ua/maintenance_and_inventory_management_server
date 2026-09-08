import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type {
  ApproveWorkOrderRequest,
  CreateWorkOrderRequest,
  RejectWorkOrderRequest,
  WorkOrderRequestIdParam,
  WorkOrderRequestsQuery,
} from "./work-order-requests.schemas";
import { workOrderRequestsService } from "./work-order-requests.service";

export const workOrderRequestsController = {
  create: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const data = req.body as CreateWorkOrderRequest;

    const request = await workOrderRequestsService.create(data, req.user.id);

    res.status(201).json({ success: true, data: request });
  },
  findAll: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const query = req.query as unknown as WorkOrderRequestsQuery;

    const result = await workOrderRequestsService.findAll(query, {
      id: req.user.id,
      roles: req.user.roles,
    });

    res.json({ success: true, ...result });
  },
  findById: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as WorkOrderRequestIdParam;

    const request = await workOrderRequestsService.findById(id, {
      id: req.user.id,
      roles: req.user.roles,
    });

    res.json({ success: true, data: request });
  },
  approve: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as WorkOrderRequestIdParam;
    const body = req.body as ApproveWorkOrderRequest;

    const request = await workOrderRequestsService.approve(
      id,
      { id: req.user.id, roles: req.user.roles },
      body,
    );

    res.json({ success: true, data: request });
  },
  reject: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as WorkOrderRequestIdParam;
    const body = req.body as RejectWorkOrderRequest;

    const request = await workOrderRequestsService.reject(
      id,
      { id: req.user.id, roles: req.user.roles },
      body,
    );

    res.json({ success: true, data: request });
  },
};
