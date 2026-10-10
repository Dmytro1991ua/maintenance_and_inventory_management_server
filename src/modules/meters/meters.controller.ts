import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type {
  CreateMeter,
  MeterIdParam,
  MetersQuery,
  ReadingsQuery,
  RecordReading,
  UpdateMeter,
} from "./meters.schemas";
import { metersService } from "./meters.service";

export const metersController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const result = await metersService.findAll(req.query as unknown as MetersQuery);

    res.json({ success: true, ...result });
  },
  findReadings: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as MeterIdParam;

    const result = await metersService.findReadings(id, req.query as unknown as ReadingsQuery);

    res.json({ success: true, ...result });
  },
  create: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const meter = await metersService.create(req.body as CreateMeter, req.user.id);

    res.status(201).json({ success: true, data: meter });
  },
  update: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as MeterIdParam;
    const { name } = req.body as UpdateMeter;

    const meter = await metersService.update(id, name);

    res.json({ success: true, data: meter });
  },
  delete: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as MeterIdParam;

    await metersService.delete(id);

    res.status(204).send();
  },
  recordReading: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as MeterIdParam;
    const { value } = req.body as RecordReading;

    const data = await metersService.recordReading(id, value, req.user.id);

    res.status(201).json({ success: true, data });
  },
};
