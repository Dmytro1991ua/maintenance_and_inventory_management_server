import { loggerMock } from "../../../mocks";
import { runJob } from "../../../../src/jobs/cron/runJob";

jest.mock("../../../../src/config", () => ({
  logger: loggerMock,
}));

describe("runJob", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should run the task", async () => {
    const task = jest.fn().mockResolvedValue(undefined);

    await runJob("test-job", task);

    expect(task).toHaveBeenCalled();
  });

  it("should log that the job started before running the task", async () => {
    const task = jest.fn().mockResolvedValue(undefined);

    await runJob("test-job", task);

    expect(loggerMock.info).toHaveBeenCalledWith({ job: "test-job" }, "started");
  });

  it("should not throw or reject when the task rejects", async () => {
    const task = jest.fn().mockRejectedValue(new Error("DB connection lost"));

    await expect(runJob("test-job", task)).resolves.toBeUndefined();
  });

  it("should log the failure when the task rejects", async () => {
    const error = new Error("DB connection lost");
    const task = jest.fn().mockRejectedValue(error);

    await runJob("test-job", task);

    expect(loggerMock.error).toHaveBeenCalledWith({ job: "test-job", err: error }, "failed");
  });
});
