import { ConflictError, NotFoundError } from "../../../src/errors";
import { assetsRepositoryMock, loggerMock, metersRepositoryMock } from "../../mocks";

jest.mock("../../../src/modules/meters/meters.repository", () => ({
  metersRepository: metersRepositoryMock,
}));

jest.mock("../../../src/modules/assets/assets.repository", () => ({
  assetsRepository: assetsRepositoryMock,
}));

jest.mock("../../../src/modules/recurring-tasks/recurring-tasks.meter", () => ({
  evaluateMeterSchedules: jest.fn(),
}));

jest.mock("../../../src/modules/recurring-tasks/recurring-tasks.repository", () => ({
  recurringTasksRepository: { countByMeter: jest.fn() },
}));

jest.mock("../../../src/config", () => ({ logger: loggerMock }));

import { metersService } from "../../../src/modules/meters/meters.service";
import { evaluateMeterSchedules } from "../../../src/modules/recurring-tasks/recurring-tasks.meter";
import { recurringTasksRepository } from "../../../src/modules/recurring-tasks/recurring-tasks.repository";

const evaluateMock = evaluateMeterSchedules as jest.MockedFunction<typeof evaluateMeterSchedules>;
const countByMeterMock = recurringTasksRepository.countByMeter as jest.MockedFunction<
  typeof recurringTasksRepository.countByMeter
>;

const meter = { id: "meter-1", assetId: "asset-1", name: "Engine hours", currentReading: 100 };

describe("metersService.recordReading", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should return the recorded reading, with the tasks it triggered", async () => {
    const recorded = { reading: { value: 120 }, meter: { currentReading: 120 } };
    metersRepositoryMock.recordReading.mockResolvedValue(recorded);
    evaluateMock.mockResolvedValue([{ id: "task-1", title: "Change oil" }]);

    const result = await metersService.recordReading("meter-1", 120, "user-1");

    expect(result).toEqual({
      ...recorded,
      triggeredTasks: [{ id: "task-1", title: "Change oil" }],
    });
    expect(evaluateMock).toHaveBeenCalledWith("meter-1", 120);
    expect(metersRepositoryMock.findById).not.toHaveBeenCalled();
  });

  it("should still record the reading when evaluating schedules fails", async () => {
    const recorded = { reading: { value: 120 }, meter: { currentReading: 120 } };
    metersRepositoryMock.recordReading.mockResolvedValue(recorded);
    evaluateMock.mockRejectedValue(new Error("db down"));

    const result = await metersService.recordReading("meter-1", 120, "user-1");

    expect(result).toEqual({ ...recorded, triggeredTasks: [] });
  });

  it("should not evaluate schedules when the reading was rejected", async () => {
    metersRepositoryMock.recordReading.mockResolvedValue(null);
    metersRepositoryMock.findById.mockResolvedValue(meter);

    await expect(metersService.recordReading("meter-1", 50, "user-1")).rejects.toThrow(
      ConflictError,
    );
    expect(evaluateMock).not.toHaveBeenCalled();
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

describe("metersService.delete", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should refuse to delete a meter that triggers maintenance schedules", async () => {
    metersRepositoryMock.findById.mockResolvedValue(meter);
    countByMeterMock.mockResolvedValue(2);

    await expect(metersService.delete("meter-1")).rejects.toThrow(ConflictError);
    expect(metersRepositoryMock.delete).not.toHaveBeenCalled();
  });

  it("should delete a meter nothing depends on", async () => {
    metersRepositoryMock.findById.mockResolvedValue(meter);
    countByMeterMock.mockResolvedValue(0);

    await metersService.delete("meter-1");

    expect(metersRepositoryMock.delete).toHaveBeenCalledWith("meter-1");
  });
});
