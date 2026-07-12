import { ConflictError, NotFoundError } from "../../../src/errors";
import { buildInventoryItem, inventoryRepositoryMock } from "../../mocks";
import { inventoryService } from "../../../src/modules/inventory/inventory.service";

jest.mock("../../../src/modules/inventory/inventory.repository", () => ({
  inventoryRepository: inventoryRepositoryMock,
}));

describe("inventoryService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return the inventory item when it exists", async () => {
    const mockInventoryItem = buildInventoryItem();

    inventoryRepositoryMock.findById.mockResolvedValue(mockInventoryItem);

    const result = await inventoryService.findById(mockInventoryItem.id);

    expect(result).toEqual(mockInventoryItem);
  });

  it("should throw NotFoundError when finding a nonexistent item", async () => {
    inventoryRepositoryMock.findById.mockResolvedValue(null);

    await expect(inventoryService.findById("nonexistent")).rejects.toThrow(NotFoundError);
  });

  it("should create an inventory item when the serial number is unique", async () => {
    const mockInventoryItem = buildInventoryItem();

    inventoryRepositoryMock.findBySerialNumber.mockResolvedValue(null);
    inventoryRepositoryMock.create.mockResolvedValue(mockInventoryItem);

    const result = await inventoryService.create({
      name: mockInventoryItem.name,
      serialNumber: mockInventoryItem.serialNumber,
      category: mockInventoryItem.category,
      quantity: mockInventoryItem.quantity,
      minStockLevel: mockInventoryItem.minStockLevel,
    });

    expect(result).toEqual(mockInventoryItem);
    expect(inventoryRepositoryMock.create).toHaveBeenCalled();
  });

  it("should throw ConflictError when serial number already exists", async () => {
    inventoryRepositoryMock.findBySerialNumber.mockResolvedValue({ id: "existing-item" });

    await expect(
      inventoryService.create({
        name: "Duplicate Drill",
        serialNumber: "SN-EXISTING",
        category: "TOOLS",
        quantity: 1,
        minStockLevel: 1,
      }),
    ).rejects.toThrow(ConflictError);

    expect(inventoryRepositoryMock.create).not.toHaveBeenCalled();
  });

  it("should update an existing item", async () => {
    const mockInventoryItem = buildInventoryItem();

    inventoryRepositoryMock.findById.mockResolvedValue(mockInventoryItem);
    inventoryRepositoryMock.update.mockResolvedValue({ ...mockInventoryItem, quantity: 5 });

    const result = await inventoryService.update(mockInventoryItem.id, { quantity: 5 });

    expect(result.quantity).toBe(5);
  });

  it("should throw NotFoundError when item does not exist", async () => {
    inventoryRepositoryMock.findById.mockResolvedValue(null);

    await expect(inventoryService.update("nonexistent", { quantity: 5 })).rejects.toThrow(
      NotFoundError,
    );

    expect(inventoryRepositoryMock.update).not.toHaveBeenCalled();
  });

  it("should delete an existing item", async () => {
    const mockInventoryItem = buildInventoryItem();

    inventoryRepositoryMock.findById.mockResolvedValue(mockInventoryItem);
    inventoryRepositoryMock.delete.mockResolvedValue(undefined);

    await inventoryService.delete(mockInventoryItem.id);

    expect(inventoryRepositoryMock.delete).toHaveBeenCalledWith(mockInventoryItem.id);
  });

  it("should throw NotFoundError when deleting an item that does not exist", async () => {
    inventoryRepositoryMock.findById.mockResolvedValue(null);

    await expect(inventoryService.delete("nonexistent")).rejects.toThrow(NotFoundError);
  });
});
