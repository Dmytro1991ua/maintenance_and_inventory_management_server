import { prisma } from "../../../src/config";
import { generateRecurringTasks } from "../../../src/jobs/cron/tasks/generateRecurringTasks";
import {
  createManagerUser,
  createTechnicianUser,
  createTestRecurringTask,
  createTestTask,
} from "../helpers";

// Fixed dates, well clear of any DST change, so the interval arithmetic doesn't
// depend on the machine's timezone. PAST is always due; FUTURE never is.
const PAST = new Date("2026-01-05T00:00:00.000Z");
const FUTURE = new Date("2999-01-01T00:00:00.000Z");

const tasksFor = (recurringTaskId: string) =>
  prisma.task.findMany({ where: { recurringTaskId }, orderBy: { createdAt: "asc" } });

const nextDueAt = async (id: string) =>
  (await prisma.recurringTask.findUniqueOrThrow({ where: { id } })).nextDueAt.toISOString();

describe("generateRecurringTasks", () => {
  it("should create an OPEN task copying the schedule, due on the schedule's date", async () => {
    const technician = await createTechnicianUser();
    const schedule = await createTestRecurringTask({
      title: "Replace HVAC filter",
      description: "Use a MERV-13 unit.",
      priority: "HIGH",
      category: "HVAC",
      assignedTo: technician.id,
      nextDueAt: PAST,
    });

    await generateRecurringTasks();

    const tasks = await tasksFor(schedule.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: "Replace HVAC filter",
      description: "Use a MERV-13 unit.",
      priority: "HIGH",
      category: "HVAC",
      assignedTo: technician.id,
      status: "OPEN",
      recurringTaskId: schedule.id,
    });
    expect(tasks[0].dueDate?.toISOString()).toBe(PAST.toISOString());
  });

  it("should advance the schedule by its interval from the previous due date", async () => {
    const schedule = await createTestRecurringTask({ intervalDays: 7, nextDueAt: PAST });

    await generateRecurringTasks();

    expect(await nextDueAt(schedule.id)).toBe("2026-01-12T00:00:00.000Z");
  });

  it("should skip schedules that aren't due yet, leaving them untouched", async () => {
    const schedule = await createTestRecurringTask({ nextDueAt: FUTURE });

    await generateRecurringTasks();

    expect(await tasksFor(schedule.id)).toHaveLength(0);
    expect(await nextDueAt(schedule.id)).toBe(FUTURE.toISOString());
  });

  it("should skip paused schedules even when they are overdue", async () => {
    const schedule = await createTestRecurringTask({ isActive: false, nextDueAt: PAST });

    await generateRecurringTasks();

    expect(await tasksFor(schedule.id)).toHaveLength(0);
    expect(await nextDueAt(schedule.id)).toBe(PAST.toISOString());
  });

  it("should generate for every due schedule in one run", async () => {
    const manager = await createManagerUser();
    const a = await createTestRecurringTask({ createdBy: manager.id, title: "A" });
    const b = await createTestRecurringTask({ createdBy: manager.id, title: "B" });
    const notDue = await createTestRecurringTask({ createdBy: manager.id, nextDueAt: FUTURE });

    await generateRecurringTasks();

    expect(await tasksFor(a.id)).toHaveLength(1);
    expect(await tasksFor(b.id)).toHaveLength(1);
    expect(await tasksFor(notDue.id)).toHaveLength(0);
  });

  it("should leave the task unassigned when the schedule has no default assignee", async () => {
    const schedule = await createTestRecurringTask({ assignedTo: null });

    await generateRecurringTasks();

    expect((await tasksFor(schedule.id))[0].assignedTo).toBeNull();
  });

  describe("busy default assignee", () => {
    // A technician may only hold one active task, so a schedule whose assignee is
    // busy still generates its task, just unassigned for a manager to pick up.
    it.each(["OPEN", "IN_PROGRESS"] as const)(
      "should create the task unassigned when the assignee already has an %s task",
      async (status) => {
        const technician = await createTechnicianUser();
        await createTestTask({ assignedTo: technician.id, status });
        const schedule = await createTestRecurringTask({ assignedTo: technician.id });

        await generateRecurringTasks();

        const tasks = await tasksFor(schedule.id);
        expect(tasks).toHaveLength(1);
        expect(tasks[0].assignedTo).toBeNull();
        // The schedule still advances: a PM task is never silently dropped.
        expect(await nextDueAt(schedule.id)).toBe("2026-01-12T00:00:00.000Z");
      },
    );

    it.each(["DONE", "CANCELLED"] as const)(
      "should still assign the task when the assignee's other task is %s",
      async (status) => {
        const technician = await createTechnicianUser();
        await createTestTask({ assignedTo: technician.id, status });
        const schedule = await createTestRecurringTask({ assignedTo: technician.id });

        await generateRecurringTasks();

        expect((await tasksFor(schedule.id))[0].assignedTo).toBe(technician.id);
      },
    );
  });

  // Pinned current behaviour (not necessarily desirable): the due date advances
  // from the PREVIOUS due date, not from today, so a schedule that fell several
  // intervals behind catches up one task per run instead of jumping to the present.
  describe("catching up an overdue schedule", () => {
    it("should generate one task per run, advancing one interval at a time", async () => {
      const schedule = await createTestRecurringTask({ intervalDays: 7, nextDueAt: PAST });

      await generateRecurringTasks();
      await generateRecurringTasks();

      const tasks = await tasksFor(schedule.id);
      expect(tasks.map((t) => t.dueDate?.toISOString())).toEqual([
        "2026-01-05T00:00:00.000Z",
        "2026-01-12T00:00:00.000Z",
      ]);
      expect(await nextDueAt(schedule.id)).toBe("2026-01-19T00:00:00.000Z");
    });

    it("should generate a stale task for a schedule resumed after a long pause", async () => {
      const schedule = await createTestRecurringTask({ isActive: false, nextDueAt: PAST });
      await prisma.recurringTask.update({ where: { id: schedule.id }, data: { isActive: true } });

      await generateRecurringTasks();

      const tasks = await tasksFor(schedule.id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].dueDate?.toISOString()).toBe(PAST.toISOString());
    });
  });

  it("should do nothing, without error, when no schedule is due", async () => {
    await createTestRecurringTask({ nextDueAt: FUTURE });

    await expect(generateRecurringTasks()).resolves.toBeUndefined();
    expect(await prisma.task.count()).toBe(0);
  });
});
