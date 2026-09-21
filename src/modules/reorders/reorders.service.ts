import { ConflictError } from "../../errors";
import { findOrThrow } from "../../utils";
import { INVENTORY_ITEM_NOT_FOUND_MESSAGE } from "../inventory/inventory.constants";
import { inventoryRepository } from "../inventory/inventory.repository";
import {
  NOT_OPEN_MESSAGE,
  NOT_ORDERED_MESSAGE,
  NOT_PENDING_MESSAGE,
  OPEN_REORDER_EXISTS_MESSAGE,
  REORDER_NOT_FOUND_MESSAGE,
} from "./reorders.constants";
import { reordersRepository } from "./reorders.repository";
import type { ReordersQuery } from "./reorders.schemas";
import { isUniqueConstraintError, resolveReorderQuantity } from "./reorders.utils";

export const reordersService = {
  findAll: async (query: ReordersQuery) => reordersRepository.findAll(query),
  findById: async (id: string) =>
    findOrThrow(() => reordersRepository.findById(id), REORDER_NOT_FOUND_MESSAGE),
  // Manual raise by an ADMIN/MANAGER. Uses the same guarded insert as the cron:
  // the partial unique index rejects a second open reorder for the item, which
  // we surface as a clean 409 rather than the generic constraint message.
  raise: async (inventoryItemId: string, raisedBy: string) => {
    const item = await findOrThrow(
      () => inventoryRepository.findById(inventoryItemId),
      INVENTORY_ITEM_NOT_FOUND_MESSAGE,
    );

    try {
      return await reordersRepository.raise({
        inventoryItemId,
        quantity: resolveReorderQuantity(item),
        raisedBy,
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictError(OPEN_REORDER_EXISTS_MESSAGE);

      throw err;
    }
  },
  markOrdered: async (id: string, reviewedBy: string) => {
    const reorder = await findOrThrow(
      () => reordersRepository.findById(id),
      REORDER_NOT_FOUND_MESSAGE,
    );

    if (reorder.status !== "PENDING") throw new ConflictError(NOT_PENDING_MESSAGE);

    // Guarded transition is the real race guard; a null here means a concurrent
    // request moved it out of PENDING first.
    const updated = await reordersRepository.markOrdered(id, reviewedBy);

    if (!updated) throw new ConflictError(NOT_PENDING_MESSAGE);

    return updated;
  },
  receive: async (id: string, reviewedBy: string) => {
    const reorder = await findOrThrow(
      () => reordersRepository.findById(id),
      REORDER_NOT_FOUND_MESSAGE,
    );

    if (reorder.status !== "ORDERED") throw new ConflictError(NOT_ORDERED_MESSAGE);

    const updated = await reordersRepository.receive(id, reviewedBy);

    if (!updated) throw new ConflictError(NOT_ORDERED_MESSAGE);

    return updated;
  },
  cancel: async (id: string, reviewedBy: string) => {
    const reorder = await findOrThrow(
      () => reordersRepository.findById(id),
      REORDER_NOT_FOUND_MESSAGE,
    );

    if (reorder.status !== "PENDING" && reorder.status !== "ORDERED") {
      throw new ConflictError(NOT_OPEN_MESSAGE);
    }

    const updated = await reordersRepository.cancel(id, reviewedBy);

    if (!updated) throw new ConflictError(NOT_OPEN_MESSAGE);

    return updated;
  },
};
