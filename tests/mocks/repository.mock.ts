export const usersRepositoryMock = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findConflicts: jest.fn(),
  update: jest.fn(),
  updateRoles: jest.fn(),
  delete: jest.fn(),
  findByRoles: jest.fn(),
};

export const inventoryRepositoryMock = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySerialNumber: jest.fn(),
  findLowStock: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

export const tasksRepositoryMock = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findOverdue: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

export const notificationsRepositoryMock = {
  findAll: jest.fn(),
  findById: jest.fn(),
  countUnread: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  findActiveDuplicateKeys: jest.fn(),
  update: jest.fn(),
  markAllAsRead: jest.fn(),
  delete: jest.fn(),
};

export const authRepositoryMock = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByUserName: jest.fn(),
  create: jest.fn(),
};
