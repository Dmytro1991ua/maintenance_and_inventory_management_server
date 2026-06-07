import { ConflictError, NotFoundError } from "../../errors";
import { inventoryRepository } from "./inventory.repository";
import type { CreateInventoryItem, InventoryQuery, UpdateInventoryItem } from "./inventory.schemas";

export const inventoryService = {
  // Supports pagination, search, sorting, and lowStock filter.
  // lowStock=true returns only items where quantity < minStockLevel.
  findAll: async (query: InventoryQuery) => {
    return inventoryRepository.findAll(query);
  },
  findById: async (id: string) => {
    const item = await inventoryRepository.findById(id);

    if (!item) throw new NotFoundError("Inventory item not found");

    return item;
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
    const existingInventoryItem = await inventoryRepository.findById(id);

    if (!existingInventoryItem) throw new NotFoundError("Inventory item not found");

    return inventoryRepository.update(id, data);
  },
  delete: async (id: string): Promise<void> => {
    const existingInventoryItem = await inventoryRepository.findById(id);

    if (!existingInventoryItem) throw new NotFoundError("Inventory item not found");

    await inventoryRepository.delete(id);
  },
};
