import { ConflictError } from "../../errors";
import { findOrThrow } from "../../utils";
import { ASSET_NOT_FOUND_MESSAGE } from "../assets/assets.constants";
import { assetsRepository } from "../assets/assets.repository";
import {
  buildReadingBelowCurrentMessage,
  METER_NAME_EXISTS_MESSAGE,
  METER_NOT_FOUND_MESSAGE,
} from "./meters.constants";
import { metersRepository } from "./meters.repository";
import type { CreateMeter, MetersQuery, ReadingsQuery } from "./meters.schemas";

const findMeterOrThrow = (id: string) =>
  findOrThrow(() => metersRepository.findById(id), METER_NOT_FOUND_MESSAGE);

export const metersService = {
  findAll: async (query: MetersQuery) => metersRepository.findAll(query),
  findReadings: async (id: string, query: ReadingsQuery) => {
    await findMeterOrThrow(id);

    return metersRepository.findReadings(id, query);
  },
  create: async (data: CreateMeter, recordedBy: string) => {
    await findOrThrow(() => assetsRepository.findById(data.assetId), ASSET_NOT_FOUND_MESSAGE);

    // Clean 409 for the common case; the (assetId, name) unique index still
    // backstops a concurrent duplicate.
    if (await metersRepository.findByAssetAndName(data.assetId, data.name)) {
      throw new ConflictError(METER_NAME_EXISTS_MESSAGE);
    }

    return metersRepository.create(data, recordedBy);
  },
  update: async (id: string, name: string) => {
    const meter = await findMeterOrThrow(id);
    const clash = await metersRepository.findByAssetAndName(meter.assetId, name);

    if (clash && clash.id !== id) throw new ConflictError(METER_NAME_EXISTS_MESSAGE);

    return metersRepository.update(id, name);
  },
  delete: async (id: string): Promise<void> => {
    await findMeterOrThrow(id);
    await metersRepository.delete(id);
  },
  recordReading: async (id: string, value: number, recordedBy: string) => {
    const result = await metersRepository.recordReading(id, value, recordedBy);

    if (result) return result;

    // The guard didn't match: either the meter doesn't exist (404) or the reading
    // is lower than the current one (409).
    const meter = await findMeterOrThrow(id);

    throw new ConflictError(buildReadingBelowCurrentMessage(meter.currentReading));
  },
};
