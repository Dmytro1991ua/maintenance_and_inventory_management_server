import type { NextFunction, Request, Response } from "express";

import { prisma } from "../../../src/config";
import { authenticate } from "../../../src/middleware";
import { runAsUser } from "../../../src/modules/change-log/change-log.context";
import { changeLogRepository } from "../../../src/modules/change-log/change-log.repository";
import { authHeader, createAdminUser, createManagerUser, signTestAccessToken } from "../helpers";

const recordAssetCreated = (assetId: string, name = "Forklift 3") =>
  prisma.$transaction((tx) =>
    changeLogRepository.record(tx, {
      action: "CREATE",
      entityType: "ASSET",
      entityId: assetId,
      entityLabel: name,
      after: { name, status: "OPERATIONAL" },
    }),
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("changeLogRepository.record", () => {
  it("should write one entry naming the user, the entity and the changed fields", async () => {
    const admin = await createAdminUser();

    await runAsUser({ id: admin.id, userName: admin.userName }, () =>
      recordAssetCreated("asset-1"),
    );

    const [entry] = await prisma.changeLog.findMany();

    expect(entry).toMatchObject({
      userId: admin.id,
      actorLabel: admin.userName,
      action: "CREATE",
      entityType: "ASSET",
      entityId: "asset-1",
      entityLabel: "Forklift 3",
      changes: [
        { field: "name", oldValue: null, newValue: "Forklift 3" },
        { field: "status", oldValue: null, newValue: "OPERATIONAL" },
      ],
    });
  });

  it("should write nothing when no audited field changed", async () => {
    await prisma.$transaction((tx) =>
      changeLogRepository.record(tx, {
        action: "UPDATE",
        entityType: "ASSET",
        entityId: "asset-1",
        before: { name: "Forklift 3" },
        after: { name: "Forklift 3", warrantyReminderSentAt: new Date() },
      }),
    );

    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should leave no entry when the surrounding change is cancelled", async () => {
    const admin = await createAdminUser();

    await expect(
      runAsUser({ id: admin.id, userName: admin.userName }, () =>
        prisma.$transaction(async (tx) => {
          await changeLogRepository.record(tx, {
            action: "CREATE",
            entityType: "ASSET",
            entityId: "asset-1",
            after: { name: "Forklift 3" },
          });

          throw new Error("save failed after the entry was written");
        }),
      ),
    ).rejects.toThrow("save failed");

    expect(await prisma.changeLog.count()).toBe(0);
  });

  it("should record a system change with no user", async () => {
    await recordAssetCreated("asset-1");

    expect(await prisma.changeLog.findFirstOrThrow()).toMatchObject({
      userId: null,
      actorLabel: null,
    });
  });

  it("should keep each request's user separate when requests overlap", async () => {
    const [admin, manager] = [await createAdminUser(), await createManagerUser()];

    await Promise.all([
      runAsUser({ id: admin.id, userName: admin.userName }, async () => {
        await sleep(30);
        await recordAssetCreated("asset-admin");
      }),
      runAsUser({ id: manager.id, userName: manager.userName }, async () => {
        await recordAssetCreated("asset-manager");
        await sleep(60);
      }),
    ]);

    const entries = await prisma.changeLog.findMany();
    const userOf = (entityId: string) => entries.find((e) => e.entityId === entityId)?.userId;

    expect(userOf("asset-admin")).toBe(admin.id);
    expect(userOf("asset-manager")).toBe(manager.id);
  });

  it("should keep the entry and the user's name after the user's account is deleted", async () => {
    const admin = await createAdminUser();

    await runAsUser({ id: admin.id, userName: admin.userName }, () =>
      recordAssetCreated("asset-1"),
    );
    await prisma.user.delete({ where: { id: admin.id } });

    expect(await prisma.changeLog.findFirstOrThrow()).toMatchObject({
      userId: null,
      actorLabel: admin.userName,
    });
  });
});

describe("authenticate — user context", () => {
  it("should run the rest of the request as the signed-in user", async () => {
    const manager = await createManagerUser();
    const req = {
      headers: { authorization: authHeader(signTestAccessToken(manager)).Authorization },
    } as unknown as Request;

    // Records after an async hop, like a real route.
    let downstream: Promise<void> = Promise.resolve();
    const next: NextFunction = () => {
      downstream = sleep(10).then(() => recordAssetCreated("asset-1"));
    };

    await authenticate(req, {} as Response, next);
    await downstream;

    expect(await prisma.changeLog.findFirstOrThrow()).toMatchObject({
      userId: manager.id,
      actorLabel: manager.userName,
    });
  });
});
