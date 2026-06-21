import { createRedisMock } from "../../../mocks";
import { withLock } from "../../../../src/jobs/cron/withLock";

jest.mock("../../../../src/config", () => ({
  redis: createRedisMock(),
}));

import { redis } from "../../../../src/config";

const mockRedis = redis as unknown as ReturnType<typeof createRedisMock>;

describe("withLock", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should run the task when the lock is acquired", async () => {
    mockRedis.set.mockResolvedValue("OK");
    const task = jest.fn().mockResolvedValue(undefined);

    await withLock("lock:test-job", 5000, task);

    expect(task).toHaveBeenCalled();
  });

  it("should not run the task when the lock is already held by another instance", async () => {
    mockRedis.set.mockResolvedValue(null);
    const task = jest.fn().mockResolvedValue(undefined);

    await withLock("lock:test-job", 5000, task);

    expect(task).not.toHaveBeenCalled();
  });

  it("should acquire the lock with NX so only the first instance wins", async () => {
    mockRedis.set.mockResolvedValue("OK");

    await withLock("lock:test-job", 5000, jest.fn().mockResolvedValue(undefined));

    expect(mockRedis.set).toHaveBeenCalledWith("lock:test-job", expect.any(String), "PX", 5000, "NX");
  });

  it("should release the lock after the task completes", async () => {
    mockRedis.set.mockResolvedValue("OK");

    await withLock("lock:test-job", 5000, jest.fn().mockResolvedValue(undefined));

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "lock:test-job",
      expect.any(String),
    );
  });

  it("should release the lock even when the task throws", async () => {
    mockRedis.set.mockResolvedValue("OK");
    const task = jest.fn().mockRejectedValue(new Error("job blew up"));

    await expect(withLock("lock:test-job", 5000, task)).rejects.toThrow("job blew up");

    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it("should not attempt to release the lock when it was never acquired", async () => {
    mockRedis.set.mockResolvedValue(null);

    await withLock("lock:test-job", 5000, jest.fn().mockResolvedValue(undefined));

    expect(mockRedis.eval).not.toHaveBeenCalled();
  });
});
