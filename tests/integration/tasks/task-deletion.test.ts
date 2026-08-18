import request from "supertest";

import app from "../../../src/app";

jest.mock("../../../src/shared/storage.service", () => ({
  storageService: {
    deleteTaskPhoto: jest.fn().mockResolvedValue(undefined),
  },
}));

import { storageService } from "../../../src/shared/storage.service";
import { authHeader, createAdminUser, createTestTask, signTestAccessToken } from "../helpers";

const deleteTaskPhotoMock = storageService.deleteTaskPhoto as jest.Mock;

describe("DELETE /api/v1/tasks/:id — photo cleanup", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should delete before and after photos from storage when both exist", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask({
      beforePhotoUrl: "https://supabase.example.com/storage/v1/object/public/bucket/tasks/abc/before-1.jpg",
      afterPhotoUrl: "https://supabase.example.com/storage/v1/object/public/bucket/tasks/abc/after-1.jpg",
    });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
    expect(deleteTaskPhotoMock).toHaveBeenCalledTimes(2);
    expect(deleteTaskPhotoMock).toHaveBeenCalledWith(task.beforePhotoUrl);
    expect(deleteTaskPhotoMock).toHaveBeenCalledWith(task.afterPhotoUrl);
  });

  it("should not call deleteTaskPhoto when the task has no photos", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
    expect(deleteTaskPhotoMock).not.toHaveBeenCalled();
  });

  it("should still delete the task even if photo cleanup fails", async () => {
    const admin = await createAdminUser();
    deleteTaskPhotoMock.mockRejectedValueOnce(new Error("Storage unavailable"));

    const task = await createTestTask({
      beforePhotoUrl: "https://supabase.example.com/storage/v1/object/public/bucket/tasks/abc/before-1.jpg",
    });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
  });
});
