/**
 * Mock Redis client matching the subset of ioredis methods used in auth.service.
 * Pipeline mock returns an object whose chained methods all return itself,
 * mirroring ioredis's real pipeline API, then .exec() resolves to [].
 */
export const createRedisMock = () => {
  const pipelineMock = {
    set: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    smembers: jest.fn(),
    eval: jest.fn(),
    pipeline: jest.fn(() => pipelineMock),
    __pipelineMock: pipelineMock,
  };
};
