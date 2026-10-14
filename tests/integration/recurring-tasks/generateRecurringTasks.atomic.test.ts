import { prisma } from "../../../src/config";
import { generateRecurringTasks } from "../../../src/jobs/cron/tasks/generateRecurringTasks";
import { recurringTasksRepository } from "../../../src/modules/recurring-tasks/recurring-tasks.repository";
import {
  createManagerUser,
  createTechnicianUser,
  createTestAsset,
  createTestRecurringTask,
} from "../helpers";

const PAST = new Date("2026-01-05T00:00:00.000Z");

const tasksFor = (recurringTaskId: string) =>
  prisma.task.findMany({ where: { recurringTaskId }, orderBy: { createdAt: "asc" } });

const nextDueAt = async (id: string) =>
  (await prisma.recurringTask.findUniqueOrThrow({ where: { id } })).nextDueAt?.toISOString();

afterEach(() => {
  jest.restoreAllMocks();
});

describe("generateRecurringTasks: asset history", () => {
  it("should put the generated task on the schedule's asset", async () => {
    const asset = await createTestAsset();
    const schedule = await createTestRecurringTask({ nextDueAt: PAST });
    await prisma.recurringTask.update({ where: { id: schedule.id }, data: { assetId: asset.id } });

    await generateRecurringTasks();

    expect((await tasksFor(schedule.id))[0].assetId).toBe(asset.id);
  });

  it("should leave the task without an asset when the schedule has none", async () => {
    const schedule = await createTestRecurringTask({ nextDueAt: PAST });

    await generateRecurringTasks();

    expect((await tasksFor(schedule.id))[0].assetId).toBeNull();
  });
});

describe("generateRecurringTasks: atomicity", () => {
  // The task and the schedule's advance used to be two separate writes. If the
  // second failed, the task already existed and the next run created it again.
  it("should create no task, and leave the schedule alone, when advancing it fails", async () => {
    const schedule = await createTestRecurringTask({ intervalDays: 7, nextDueAt: PAST });
    jest
      .spyOn(recurringTasksRepository, "advanceNextDueAt")
      .mockRejectedValueOnce(new Error("boom"));

    await expect(generateRecurringTasks()).resolves.toBeUndefined();

    expect(await tasksFor(schedule.id)).toHaveLength(0);
    expect(await nextDueAt(schedule.id)).toBe(PAST.toISOString());
  });

  it("should generate exactly one task once the failure clears, not a duplicate", async () => {
    const schedule = await createTestRecurringTask({ intervalDays: 7, nextDueAt: PAST });
    jest
      .spyOn(recurringTasksRepository, "advanceNextDueAt")
      .mockRejectedValueOnce(new Error("boom"));

    await generateRecurringTasks(); // fails, rolls back
    await generateRecurringTasks(); // succeeds

    expect(await tasksFor(schedule.id)).toHaveLength(1);
    expect(await nextDueAt(schedule.id)).toBe("2026-01-12T00:00:00.000Z");
  });

  it("should not let one failing schedule stop the others", async () => {
    const manager = await createManagerUser();
    const a = await createTestRecurringTask({ createdBy: manager.id, title: "A" });
    const b = await createTestRecurringTask({ createdBy: manager.id, title: "B" });
    jest
      .spyOn(recurringTasksRepository, "advanceNextDueAt")
      .mockRejectedValueOnce(new Error("boom"));

    await generateRecurringTasks();

    // Exactly one of the two generated; the other rolled back cleanly.
    const generated = (await tasksFor(a.id)).length + (await tasksFor(b.id)).length;
    expect(generated).toBe(1);
  });
});

describe("generateRecurringTasks: one active task per technician", () => {
  it("should assign only one of two due schedules that share a free assignee", async () => {
    // Processed one at a time, so the second sees the first's task and falls back
    // to unassigned instead of both checking before either task exists.
    const manager = await createManagerUser();
    const technician = await createTechnicianUser();
    await createTestRecurringTask({ createdBy: manager.id, title: "A", assignedTo: technician.id });
    await createTestRecurringTask({ createdBy: manager.id, title: "B", assignedTo: technician.id });

    await generateRecurringTasks();

    const tasks = await prisma.task.findMany();
    expect(tasks).toHaveLength(2);
    expect(tasks.filter((t) => t.assignedTo === technician.id)).toHaveLength(1);
    expect(tasks.filter((t) => t.assignedTo === null)).toHaveLength(1);
  });
});
