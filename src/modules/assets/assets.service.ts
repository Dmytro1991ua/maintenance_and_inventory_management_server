import { ConflictError } from "../../errors";
import { findOrThrow } from "../../utils";
import { tasksRepository } from "../tasks/tasks.repository";
import type { TasksQuery } from "../tasks/tasks.schemas";
import { ASSET_CATEGORIES, ASSET_NOT_FOUND_MESSAGE } from "./assets.constants";
import { assetsRepository } from "./assets.repository";
import type { AssetsQuery, CreateAsset, UpdateAsset } from "./assets.schemas";

export const assetsService = {
  getCategories: () => [...ASSET_CATEGORIES],

  getStats: async () => assetsRepository.getStats(),

  findAll: async (query: AssetsQuery) => {
    return assetsRepository.findAll(query);
  },
  findById: async (id: string) => {
    return findOrThrow(() => assetsRepository.findById(id), ASSET_NOT_FOUND_MESSAGE);
  },
  // Maintenance history — every task recorded against this asset. Verifies the
  // asset exists first so an unknown id 404s rather than returning an empty
  // page indistinguishable from "asset exists but has no tasks".
  findTasks: async (assetId: string, query: TasksQuery) => {
    await findOrThrow(() => assetsRepository.findById(assetId), ASSET_NOT_FOUND_MESSAGE);

    return tasksRepository.findAll({ ...query, assetId });
  },
  // Serial numbers must be globally unique — enforced at service level (UX)
  // and by DB UNIQUE constraint (race condition safety).
  create: async (data: CreateAsset) => {
    const existingAsset = await assetsRepository.findBySerialNumber(data.serialNumber);

    if (existingAsset) throw new ConflictError("Serial number already exists");

    return assetsRepository.create(data);
  },
  // serialNumber is intentionally not updatable —
  // it's a physical identifier that should never change after creation.
  update: async (id: string, data: UpdateAsset) => {
    await findOrThrow(() => assetsRepository.findById(id), ASSET_NOT_FOUND_MESSAGE);

    return assetsRepository.update(id, data);
  },
  // Deleting an asset nulls assetId on its terminal tasks (onDelete: SetNull) —
  // that history is preserved, only the asset link is severed. But an asset with
  // OPEN/IN_PROGRESS tasks is mid-maintenance; deleting it is almost certainly a
  // mistake, so refuse (409) and steer the caller toward RETIRED instead.
  delete: async (id: string): Promise<void> => {
    await findOrThrow(() => assetsRepository.findById(id), ASSET_NOT_FOUND_MESSAGE);

    if (await assetsRepository.hasActiveTasks(id)) {
      throw new ConflictError(
        "Cannot delete an asset with active (open or in-progress) tasks. Close those tasks or set the asset to RETIRED instead.",
      );
    }

    await assetsRepository.delete(id);
  },
};
