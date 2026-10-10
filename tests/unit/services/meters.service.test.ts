import { ConflictError, NotFoundError } from "../../../src/errors";
import { assetsRepositoryMock, metersRepositoryMock } from "../../mocks";

jest.mock("../../../src/modules/meters/meters.repository", () => ({
  metersRepository: metersRepositoryMock,
}));

jest.mock("../../../src/modules/assets/assets.repository", () => ({
  assetsRepository: assetsRepositoryMock,
}));

import { metersService } from "../../../src/modules/meters/meters.service";

const meter = { id: "meter-1", assetId: "asset-1", name: "Engine hours", currentReading: 100 };

describe("metersService.recordReading", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should return the recorded reading when the guarded update matches", async () => {
    const recorded = { reading: { value: 120 }, meter: { currentReading: 120 } };
    metersRepositoryMock.recordReading.mockResolvedValue(recorded);

    const result = await metersService.recordReading("meter-1", 120, "user-1");

    expect(result).toBe(recorded);
    expect(metersRepositoryMock.findById).not.toHaveBeenCalled();
  });

  it("should 409 with the current reading when the value is too low", async () => {
    metersRepositoryMock.recordReading.mockResolvedValue(null);
    metersRepositoryMock.findById.mockResolvedValue(meter);

    const attempt = metersService.recordReading("meter-1", 50, "user-1");

    await expect(attempt).rejects.toThrow(ConflictError);
    await expect(attempt).rejects.toThrow("(100)");
  });

  it("should 404, not 409, when the guard missed because the meter is gone", async () => {
    metersRepositoryMock.recordReading.mockResolvedValue(null);
    metersRepositoryMock.findById.mockResolvedValue(null);

    await expect(metersService.recordReading("meter-1", 50, "user-1")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("metersService.update", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should let a meter keep its own name", async () => {
    metersRepositoryMock.findById.mockResolvedValue(meter);
    metersRepositoryMock.findByAssetAndName.mockResolvedValue({ id: "meter-1" });
    metersRepositoryMock.update.mockResolvedValue(meter);

    await metersService.update("meter-1", "Engine hours");

    expect(metersRepositoryMock.update).toHaveBeenCalledWith("meter-1", "Engine hours");
  });

  it("should 409 when another meter on the asset already has the name", async () => {
    metersRepositoryMock.findById.mockResolvedValue(meter);
    metersRepositoryMock.findByAssetAndName.mockResolvedValue({ id: "meter-2" });

    await expect(metersService.update("meter-1", "Odometer")).rejects.toThrow(ConflictError);
    expect(metersRepositoryMock.update).not.toHaveBeenCalled();
  });
});
