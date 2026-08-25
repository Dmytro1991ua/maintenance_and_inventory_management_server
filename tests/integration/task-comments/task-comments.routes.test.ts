import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestTask,
  createTestTaskComment,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/v1/tasks/:id/comments", () => {
  it("should return the task's comments oldest first", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();

    await createTestTaskComment({
      taskId: task.id,
      authorId: user.id,
      body: "Second",
      createdAt: new Date("2026-08-20T10:00:00Z"),
    });
    await createTestTaskComment({
      taskId: task.id,
      authorId: user.id,
      body: "First",
      createdAt: new Date("2026-08-19T10:00:00Z"),
    });

    const response = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data.map((comment: { body: string }) => comment.body)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("should include the author but never the author's password", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();

    await createTestTaskComment({ taskId: task.id, authorId: user.id });

    const response = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data[0].author).toEqual({
      id: user.id,
      userName: user.userName,
      email: user.email,
    });
  });

  it("should not return comments belonging to another task", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();
    const otherTask = await createTestTask();

    await createTestTaskComment({ taskId: task.id, authorId: user.id, body: "Mine" });
    await createTestTaskComment({ taskId: otherTask.id, authorId: user.id, body: "Theirs" });

    const response = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].body).toBe("Mine");
  });

  it("should return an empty list for a task with no comments", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("should return 404 when the task does not exist", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/tasks/${NONEXISTENT_ID}/comments`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(404);
  });

  it("should return 400 when the task id is not a uuid", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/tasks/not-a-uuid/comments")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(400);
  });

  it("should return 401 when no token is provided", async () => {
    const task = await createTestTask();

    const response = await request(app).get(`/api/v1/tasks/${task.id}/comments`);

    expect(response.status).toBe(401);
  });
});

describe("POST /api/v1/tasks/:id/comments", () => {
  it("should create a comment authored by the requesting user", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ body: "Found worn bearings at joint 3." });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      taskId: task.id,
      body: "Found worn bearings at joint 3.",
      author: { id: user.id, userName: user.userName },
    });

    const stored = await prisma.taskComment.findMany({ where: { taskId: task.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].authorId).toBe(user.id);
  });

  it("should let any authenticated role comment", async () => {
    const task = await createTestTask();
    const users = [
      await createAdminUser(),
      await createManagerUser(),
      await createTechnicianUser(),
    ];

    for (const user of users) {
      const response = await request(app)
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set(authHeader(signTestAccessToken(user)))
        .send({ body: `Note from ${user.userName}` });

      expect(response.status).toBe(201);
    }
  });

  it("should reject a client-supplied authorId rather than trusting it", async () => {
    const user = await createTechnicianUser();
    const otherUser = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ body: "Spoofed", authorId: otherUser.id });

    // CreateTaskCommentSchema is .strict() — unknown keys are rejected outright
    expect(response.status).toBe(400);
  });

  it("should return 400 for an empty body", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ body: "" });

    expect(response.status).toBe(400);
  });

  it("should return 400 when the body exceeds 2000 characters", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ body: "a".repeat(2001) });

    expect(response.status).toBe(400);
  });

  it("should return 404 when the task does not exist", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .post(`/api/v1/tasks/${NONEXISTENT_ID}/comments`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ body: "Orphan" });

    expect(response.status).toBe(404);
  });

  it("should return 401 when no token is provided", async () => {
    const task = await createTestTask();

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .send({ body: "Anonymous" });

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/v1/tasks/:id/comments/:commentId", () => {
  it("should let the author delete their own comment", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();
    const comment = await createTestTaskComment({ taskId: task.id, authorId: user.id });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(204);
    expect(await prisma.taskComment.findUnique({ where: { id: comment.id } })).toBeNull();
  });

  it("should let an ADMIN delete another user's comment", async () => {
    const author = await createTechnicianUser();
    const admin = await createAdminUser();
    const task = await createTestTask();
    const comment = await createTestTaskComment({ taskId: task.id, authorId: author.id });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
    expect(await prisma.taskComment.findUnique({ where: { id: comment.id } })).toBeNull();
  });

  it("should return 403 when a non-author, non-admin tries to delete", async () => {
    const author = await createTechnicianUser();
    const otherUser = await createTechnicianUser();
    const task = await createTestTask();
    const comment = await createTestTaskComment({ taskId: task.id, authorId: author.id });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(authHeader(signTestAccessToken(otherUser)));

    expect(response.status).toBe(403);
    expect(await prisma.taskComment.findUnique({ where: { id: comment.id } })).not.toBeNull();
  });

  it("should return 403 for a MANAGER deleting another user's comment", async () => {
    const author = await createTechnicianUser();
    const manager = await createManagerUser();
    const task = await createTestTask();
    const comment = await createTestTaskComment({ taskId: task.id, authorId: author.id });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(403);
  });

  it("should return 404 when the comment belongs to a different task", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();
    const otherTask = await createTestTask();
    const comment = await createTestTaskComment({ taskId: otherTask.id, authorId: user.id });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(404);
    expect(await prisma.taskComment.findUnique({ where: { id: comment.id } })).not.toBeNull();
  });

  it("should return 404 when the comment does not exist", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(404);
  });

  it("should return 401 when no token is provided", async () => {
    const user = await createTechnicianUser();
    const task = await createTestTask();
    const comment = await createTestTaskComment({ taskId: task.id, authorId: user.id });

    const response = await request(app).delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`);

    expect(response.status).toBe(401);
  });
});

describe("task comment cascade", () => {
  it("should delete a task's comments when the task is deleted", async () => {
    const admin = await createAdminUser();
    const task = await createTestTask();

    await createTestTaskComment({ taskId: task.id, authorId: admin.id });
    await createTestTaskComment({ taskId: task.id, authorId: admin.id });

    const response = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
    expect(await prisma.taskComment.count({ where: { taskId: task.id } })).toBe(0);
  });
});
