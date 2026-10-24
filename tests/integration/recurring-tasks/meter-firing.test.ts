import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { checkMeterSchedules } from "../../../src/jobs/cron/tasks/checkMeterSchedules";
import {
  fireMeterSchedule,
  sweepMeterSchedules,
} from "../../../src/modules/recurring-tasks/recurring-tasks.meter";
import { recurringTasksRepository } from "../../../src/modules/recurring-tasks/recurring-tasks.repository";
import { tasksRepository } from "../../../src/modules/tasks/tasks.repository";
import { MS_PER_DAY } from "../../../src/utils/date";
import {
  authHeader,
  createManagerUser,
  createTechnicianUser,
  createTestMeter,
  createTestMeterSchedule,
  createTestTask,
  signTestAccessToken,
} from "../helpers";

const record = (token: string, meterId: string, value: number) =>
  request(app).post(`/api/v1/meters/${meterId}/readings`).set(authHeader(token)).send({ value });

const tasksFor = (recurringTaskId: string) =>
  prisma.task.findMany({ where: { recurringTaskId }, orderBy: { createdAt: "asc" } });

const nextDue = async (id: string) =>
  (await prisma.recurringTask.findUniqueOrThrow({ where: { id } })).nextDueReading;

const closeTask = (id: string, status: "DONE" | "CANCELLED" = "DONE") =>
  prisma.task.update({ where: { id }, data: { status } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A meter at reading 0 with one schedule (every 250 from 250), and a technician to record.
const setup = async (schedule: Parameters<typeof createTestMeterSchedule>[0] = {}) => {
  const technician = await createTechnicianUser();
  const meter = await createTestMeter({ currentReading: 0 });
  const created = await createTestMeterSchedule({ meterId: meter.id, ...schedule });

  return { technician, token: signTestAccessToken(technician), meter, schedule: created };
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("firing when a reading is recorded", () => {
  it("should do nothing below the threshold", async () => {
    const { token, meter, schedule } = await setup();

    const response = await record(token, meter.id, 249);

    expect(response.status).toBe(201);
    expect(response.body.data.triggeredTasks).toEqual([]);
    expect(await tasksFor(schedule.id)).toHaveLength(0);
    expect(await nextDue(schedule.id)).toBe(250);
  });

  it("should create the PM task when a reading reaches the threshold exactly", async () => {
    const { token, meter, schedule } = await setup({
      title: "Change engine oil",
      description: "Use 5W-30.",
      priority: "HIGH",
      category: "TOOLS",
    });

    const response = await record(token, meter.id, 250);

    const [task] = await tasksFor(schedule.id);
    expect(response.body.data.triggeredTasks).toEqual([
      { id: task.id, title: "Change engine oil" },
    ]);
    expect(task).toMatchObject({
      title: "Change engine oil",
      priority: "HIGH",
      category: "TOOLS",
      status: "OPEN",
      assetId: meter.assetId,
      recurringTaskId: schedule.id,
    });
    expect(task.description).toBe(
      "Use 5W-30.\n\nTriggered by meter: Engine hours reached 250 hours (due at 250).",
    );
    // Not left without a date (it would never be reminded or flagged overdue),
    // and not due the instant it's created.
    const expectedDue = Date.now() + 7 * MS_PER_DAY;
    expect(Math.abs(task.dueDate!.getTime() - expectedDue)).toBeLessThan(60_000);
    expect(await nextDue(schedule.id)).toBe(500);
  });

  it("should skip ahead on the grid when a reading overshoots, creating one task not a backlog", async () => {
    const { token, meter, schedule } = await setup();

    await record(token, meter.id, 600);

    expect(await tasksFor(schedule.id)).toHaveLength(1);
    // Thresholds are 250, 500, 750, ...: the first above 600 is 750.
    expect(await nextDue(schedule.id)).toBe(750);
  });

  it("should fire a schedule whose first threshold is 0", async () => {
    // 0 is a valid threshold, so it must not be mistaken for "not set".
    const { token, meter, schedule } = await setup({ firstDueReading: 0, intervalReading: 100 });

    const response = await record(token, meter.id, 0);

    expect(response.body.data.triggeredTasks).toHaveLength(1);
    expect(await nextDue(schedule.id)).toBe(100);
  });

  it("should not fire again for the same reading recorded twice", async () => {
    const { token, meter, schedule } = await setup();

    await record(token, meter.id, 250);
    await record(token, meter.id, 250);

    expect(await tasksFor(schedule.id)).toHaveLength(1);
  });

  it("should leave an unassigned task when the default assignee is busy", async () => {
    const busy = await createTechnicianUser();
    await createTestTask({ assignedTo: busy.id, status: "IN_PROGRESS" });
    const { token, meter, schedule } = await setup({ assignedTo: busy.id });

    await record(token, meter.id, 250);

    const [task] = await tasksFor(schedule.id);
    expect(task.assignedTo).toBeNull();
    // The threshold still moved: a PM task is never silently dropped.
    expect(await nextDue(schedule.id)).toBe(500);
  });

  it("should assign the task to a free default assignee", async () => {
    const free = await createTechnicianUser();
    const { token, meter, schedule } = await setup({ assignedTo: free.id });

    await record(token, meter.id, 250);

    expect((await tasksFor(schedule.id))[0].assignedTo).toBe(free.id);
  });

  it("should fire every schedule on the meter that was reached, independently", async () => {
    const { token, meter } = await setup({ title: "Oil" });
    const filter = await createTestMeterSchedule({
      meterId: meter.id,
      title: "Filter",
      intervalReading: 500,
      firstDueReading: 500,
    });

    // 500 reaches the oil schedule (250, 500) and the filter schedule (500).
    const response = await record(token, meter.id, 500);

    const titles = response.body.data.triggeredTasks.map((t: { title: string }) => t.title);
    expect(titles.sort()).toEqual(["Filter", "Oil"]);
    expect(await nextDue(filter.id)).toBe(1000);
  });

  it("should not fire a paused schedule, then fire it once resumed", async () => {
    const { token, meter, schedule } = await setup({ isActive: false });

    await record(token, meter.id, 300);
    expect(await tasksFor(schedule.id)).toHaveLength(0);

    await prisma.recurringTask.update({ where: { id: schedule.id }, data: { isActive: true } });
    await record(token, meter.id, 310);

    expect(await tasksFor(schedule.id)).toHaveLength(1);
  });

  it("should not evaluate schedules for a rejected (lower) reading", async () => {
    const { token, meter, schedule } = await setup();
    await record(token, meter.id, 100);

    const response = await record(token, meter.id, 50);

    expect(response.status).toBe(409);
    expect(await tasksFor(schedule.id)).toHaveLength(0);
  });
});

describe("one open task per schedule", () => {
  it.each(["OPEN", "IN_PROGRESS"] as const)(
    "should hold the threshold while the previous task is %s",
    async (status) => {
      const { token, meter, schedule } = await setup();
      await record(token, meter.id, 250);
      const [first] = await tasksFor(schedule.id);
      await prisma.task.update({ where: { id: first.id }, data: { status } });

      // 520 reaches the next threshold (500) but the first task is still open.
      const response = await record(token, meter.id, 520);

      expect(response.body.data.triggeredTasks).toEqual([]);
      expect(await tasksFor(schedule.id)).toHaveLength(1);
      expect(await nextDue(schedule.id)).toBe(500);
    },
  );

  it.each(["DONE", "CANCELLED"] as const)(
    "should fire on the next reading once the previous task is %s, skipping ahead",
    async (status) => {
      const { token, meter, schedule } = await setup();
      await record(token, meter.id, 250);
      await record(token, meter.id, 520); // blocked, threshold stays 500
      await closeTask((await tasksFor(schedule.id))[0].id, status);

      const response = await record(token, meter.id, 530);

      expect(response.body.data.triggeredTasks).toHaveLength(1);
      expect(await tasksFor(schedule.id)).toHaveLength(2);
      // From 530 on the 250 grid, the next threshold is 750.
      expect(await nextDue(schedule.id)).toBe(750);
    },
  );
});

describe("failure handling", () => {
  it("should still record the reading, roll the threshold back, and retry on the next reading", async () => {
    const { token, meter, schedule } = await setup();
    jest.spyOn(tasksRepository, "createFromSchedule").mockRejectedValueOnce(new Error("boom"));

    const failed = await record(token, meter.id, 250);

    expect(failed.status).toBe(201);
    expect(failed.body.data.meter.currentReading).toBe(250);
    expect(failed.body.data.triggeredTasks).toEqual([]);
    expect(await tasksFor(schedule.id)).toHaveLength(0);
    // Rolled back with the failed task, so nothing was lost.
    expect(await nextDue(schedule.id)).toBe(250);

    const retried = await record(token, meter.id, 260);

    expect(retried.body.data.triggeredTasks).toHaveLength(1);
    expect(await nextDue(schedule.id)).toBe(500);
  });
});

describe("concurrency", () => {
  it("should create one task when two firings queue on the schedule's row lock, even if the second crosses the next threshold", async () => {
    // Hold the schedule row's lock, then queue two firings behind it in order. The
    // first moves the threshold to 200 and creates a task; the second (reading 200)
    // is then due again, so only the open-task check inside the transaction stops a
    // second task.
    const { meter, schedule } = await setup({ intervalReading: 100, firstDueReading: 100 });
    const [snapshot] = await recurringTasksRepository.findActiveMeterSchedules(meter.id);
    let held!: () => void;
    let release!: () => void;
    const acquired = new Promise<void>((resolve) => (held = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));

    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM recurring_tasks WHERE id = ${schedule.id} FOR UPDATE`;
      held();
      await gate;
    });
    await acquired;

    const first = fireMeterSchedule(snapshot, 100);
    await sleep(150);
    const second = fireMeterSchedule(snapshot, 200);
    await sleep(150);
    release();
    await holder;
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).not.toBeNull();
    expect(secondResult).toBeNull();
    expect(await tasksFor(schedule.id)).toHaveLength(1);
    expect(await nextDue(schedule.id)).toBe(200);
  });

  it("should not fire a schedule that was paused after it was read", async () => {
    // The normal paths only load active schedules, so the guard's own isActive
    // check matters when a manager pauses one between the read and the firing.
    const { meter, schedule } = await setup();
    const [snapshot] = await recurringTasksRepository.findActiveMeterSchedules(meter.id);
    await prisma.recurringTask.update({ where: { id: schedule.id }, data: { isActive: false } });

    const result = await fireMeterSchedule(snapshot, 300);

    expect(result).toBeNull();
    expect(await tasksFor(schedule.id)).toHaveLength(0);
    expect(await nextDue(schedule.id)).toBe(250);
  });

  it("should create one task when the same reading fires the schedule twice at once", async () => {
    const { meter, schedule } = await setup({ intervalReading: 100, firstDueReading: 100 });
    const [snapshot] = await recurringTasksRepository.findActiveMeterSchedules(meter.id);

    const results = await Promise.all([
      fireMeterSchedule(snapshot, 100),
      fireMeterSchedule(snapshot, 100),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await tasksFor(schedule.id)).toHaveLength(1);
  });

  it("should create one task when two readings that both cross a threshold arrive together", async () => {
    const { token, meter, schedule } = await setup({ intervalReading: 100, firstDueReading: 100 });

    const responses = await Promise.all([
      record(token, meter.id, 100),
      record(token, meter.id, 200),
    ]);

    expect(responses.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(await tasksFor(schedule.id)).toHaveLength(1);
  });
});

describe("the nightly sweep", () => {
  // Simulate a reading that committed but never produced its task (a crash between
  // the two): the meter is past the threshold and no task exists.
  const pastThreshold = async (reading: number, schedule: Parameters<typeof setup>[0] = {}) => {
    const ctx = await setup(schedule);
    await prisma.meter.update({ where: { id: ctx.meter.id }, data: { currentReading: reading } });

    return ctx;
  };

  it("should create the task a crash left behind", async () => {
    const { schedule } = await pastThreshold(300);

    const result = await sweepMeterSchedules();

    expect(result).toEqual({ checked: 1, fired: 1, failed: 0 });
    expect(await tasksFor(schedule.id)).toHaveLength(1);
    expect(await nextDue(schedule.id)).toBe(500);
  });

  it("should fire once the previous task has closed, skipping ahead", async () => {
    const { token, meter, schedule } = await setup();
    await record(token, meter.id, 250);
    await record(token, meter.id, 520); // blocked by the open task
    await sweepMeterSchedules(); // still blocked
    expect(await tasksFor(schedule.id)).toHaveLength(1);

    await closeTask((await tasksFor(schedule.id))[0].id);
    const result = await sweepMeterSchedules();

    expect(result.fired).toBe(1);
    expect(await tasksFor(schedule.id)).toHaveLength(2);
    expect(await nextDue(schedule.id)).toBe(750);
  });

  it("should fire a schedule created with a threshold already behind its meter", async () => {
    const { schedule } = await pastThreshold(1240, { firstDueReading: 1000 });

    await sweepMeterSchedules();

    expect(await tasksFor(schedule.id)).toHaveLength(1);
    expect(await nextDue(schedule.id)).toBe(1250);
  });

  it("should skip paused schedules and ones not yet due", async () => {
    const paused = await pastThreshold(300, { isActive: false });
    const notDue = await setup({ firstDueReading: 5000 });

    const result = await sweepMeterSchedules();

    expect(result).toEqual({ checked: 0, fired: 0, failed: 0 });
    expect(await tasksFor(paused.schedule.id)).toHaveLength(0);
    expect(await tasksFor(notDue.schedule.id)).toHaveLength(0);
  });

  it("should not let one failing schedule stop the others", async () => {
    const { meter } = await pastThreshold(300);
    const second = await createTestMeterSchedule({ meterId: meter.id, title: "Second" });
    jest.spyOn(tasksRepository, "createFromSchedule").mockRejectedValueOnce(new Error("boom"));

    const result = await sweepMeterSchedules();

    // Whichever ran first failed and rolled back; the other fired.
    expect(result).toEqual({ checked: 2, fired: 1, failed: 1 });
    expect(await prisma.task.count()).toBe(1);
    const advanced = (await prisma.recurringTask.findMany({ where: { meterId: meter.id } })).filter(
      (s) => s.nextDueReading === 500,
    );
    expect(advanced).toHaveLength(1);
    expect(second.id).toBeDefined();
  });

  it("should be what the nightly job runs", async () => {
    const { schedule } = await pastThreshold(300);

    await expect(checkMeterSchedules()).resolves.toBeUndefined();

    expect(await tasksFor(schedule.id)).toHaveLength(1);
  });

  it("should fail the nightly job when a schedule fails, after the others have run", async () => {
    const { meter } = await pastThreshold(300);
    await createTestMeterSchedule({ meterId: meter.id, title: "Second" });
    jest.spyOn(tasksRepository, "createFromSchedule").mockRejectedValueOnce(new Error("boom"));

    await expect(checkMeterSchedules()).rejects.toThrow("1 of 2 meter schedules failed to fire");

    expect(await prisma.task.count()).toBe(1);
  });
});

describe("asset history", () => {
  it("should put a meter-triggered task in its asset's maintenance history", async () => {
    const manager = await createManagerUser();
    const { token, meter, schedule } = await setup();

    await record(token, meter.id, 250);

    const response = await request(app)
      .get(`/api/v1/assets/${meter.assetId}/tasks`)
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
    expect(response.body.data.map((t: { recurringTaskId: string }) => t.recurringTaskId)).toEqual([
      schedule.id,
    ]);
  });
});
