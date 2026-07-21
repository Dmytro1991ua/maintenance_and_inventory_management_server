import { ConflictError } from "../../errors";
import { findOrThrow } from "../../utils";
import { INVENTORY_CATEGORIES, INVENTORY_ITEM_NOT_FOUND_MESSAGE } from "./inventory.constants";
import { inventoryRepository } from "./inventory.repository";
import type {
  CreateInventoryItem,
  InventoryQuery,
  RestockInventoryItem,
  UpdateInventoryItem,
} from "./inventory.schemas";

export const inventoryService = {
  getCategories: () => [...INVENTORY_CATEGORIES],

  getStats: async () => inventoryRepository.getStats(),

  // Supports pagination, search, sorting, lowStock, and category filters.
  findAll: async (query: InventoryQuery) => {
    return inventoryRepository.findAll(query);
  },
  findById: async (id: string) => {
    return findOrThrow(() => inventoryRepository.findById(id), INVENTORY_ITEM_NOT_FOUND_MESSAGE);
  },
  // Serial numbers must be globally unique — enforced at service level (UX)
  // and by DB UNIQUE constraint (race condition safety).
  create: async (data: CreateInventoryItem) => {
    const existingInventoryItem = await inventoryRepository.findBySerialNumber(data.serialNumber);

    if (existingInventoryItem) throw new ConflictError("Serial number already exists");

    return inventoryRepository.create(data);
  },
  // serialNumber is intentionally not updatable —
  // it's a physical identifier that should never change after creation.
  update: async (id: string, data: UpdateInventoryItem) => {
    await findOrThrow(() => inventoryRepository.findById(id), INVENTORY_ITEM_NOT_FOUND_MESSAGE);

    return inventoryRepository.update(id, data);
  },
  restock: async (id: string, data: RestockInventoryItem) => {
    await findOrThrow(() => inventoryRepository.findById(id), INVENTORY_ITEM_NOT_FOUND_MESSAGE);

    return inventoryRepository.restock(id, data);
  },
  delete: async (id: string): Promise<void> => {
    await findOrThrow(() => inventoryRepository.findById(id), INVENTORY_ITEM_NOT_FOUND_MESSAGE);

    await inventoryRepository.delete(id);
  },
};
