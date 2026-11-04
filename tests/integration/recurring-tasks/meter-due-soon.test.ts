import { prisma } from "../../../src/config";
import { checkMeterDueSoon } from "../../../src/jobs/cron/tasks/checkMeterDueSoon";
import { fireMeterSchedule } from "../../../src/modules/recurring-tasks/recurring-tasks.meter";
import { notificationsService } from "../../../src/modules/notifications/notifications.service";
import { tasksRepository } from "../../../src/modules/tasks/tasks.repository";
import { recurringTasksRepository } from "../../../src/modules/recurring-tasks/recurring-tasks.repository";
import {
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestMeter,
  createTestMeterSchedule,
  createTestRecurringTask,
  createTestTask,
} from "../helpers";

// Interval 250, next threshold 1000: the window is the last 25 before it (975-999).
// A technician owns the schedule, so the only recipients are the managers a test creates.
const setup = async (currentReading: number, schedule: { isActive?: boolean } = {}) => {
  const meter = await createTestMeter({ currentReading });
  const created = await createTestMeterSchedule({
    meterId: meter.id,
    title: "Oil change",
    intervalReading: 250,
    firstDueReading: 1000,
    createdBy: (await createTechnicianUser()).id,
    ...schedule,
  });

  return { meter, schedule: created };
};

const remindersFor = (relatedEntityId: string) =>
  prisma.notification.findMany({ where: { type: "METER_SERVICE_DUE", relatedEntityId } });

const setReading = (meterId: string, currentReading: number) =>
  prisma.meter.update({ where: { id: meterId }, data: { currentReading } });

describe("the meter due-soon reminder", () => {
  it.each([
    ["well before the window", 900, 0],
    ["just outside the window", 974, 0],
    ["at the edge of the window", 975, 1],
    ["just before the threshold", 999, 1],
    ["at the threshold (a task is created instead)", 1000, 0],
    ["past the threshold", 1100, 0],
  ])("should remind %s", async (_label, reading, expected) => {
    const manager = await createManagerUser();
    const { schedule } = await setup(reading);

    await checkMeterDueSoon();

    const reminders = await remindersFor(schedule.id);
    expect(reminders).toHaveLength(expected);
    expect(reminders.every((r) => r.userId === manager.id)).toBe(true);
  });

  it("should notify admins and managers, not technicians", async () => {
    const manager = await createManagerUser();
    const admin = await createAdminUser();
    const technician = await createTechnicianUser();
    const { schedule } = await setup(980);

    await checkMeterDueSoon();

    const recipients = (await remindersFor(schedule.id)).map((r) => r.userId).sort();
    expect(recipients).toEqual([manager.id, admin.id].sort());
    expect(recipients).not.toContain(technician.id);
  });

  it("should say what is due, where the meter is, and how far", async () => {
    await createManagerUser();
    const { schedule } = await setup(980);

    await checkMeterDueSoon();

    const [reminder] = await remindersFor(schedule.id);
    expect(reminder.message).toBe(
      'Service due soon: "Oil change" on Engine hours is due at 1000 hours (now 980).',
    );
  });

  it("should remind once per threshold, not every night", async () => {
    await createManagerUser();
    const { meter, schedule } = await setup(980);

    await checkMeterDueSoon();
    await setReading(meter.id, 990);
    await checkMeterDueSoon();

    expect(await remindersFor(schedule.id)).toHaveLength(1);
    const stored = await prisma.recurringTask.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.reminderSentForReading).toBe(1000);
  });

  it("should not remind again once the reminder has been read", async () => {
    await createManagerUser();
    const { meter, schedule } = await setup(980);
    await checkMeterDueSoon();
    await prisma.notification.updateMany({ data: { isRead: true } });

    await setReading(meter.id, 990);
    await checkMeterDueSoon();

    expect(await remindersFor(schedule.id)).toHaveLength(1);
  });

  it("should remind again for the next threshold, even if the last reminder was never read", async () => {
    await createManagerUser();
    const { meter, schedule } = await setup(980);
    await checkMeterDueSoon(); // reminder for 1000, left unread

    // The meter reaches 1000, the schedule fires and moves to 1250, then nears it.
    await setReading(meter.id, 1000);
    const loaded = (await recurringTasksRepository.findActiveMeterSchedules(meter.id))[0];
    await fireMeterSchedule(loaded, 1000);
    await setReading(meter.id, 1230);
    await checkMeterDueSoon();

    const reminders = await remindersFor(schedule.id);
    expect(reminders).toHaveLength(2);
    expect(reminders.filter((r) => !r.isRead)).toHaveLength(1);
    expect(reminders.find((r) => !r.isRead)?.message).toContain("due at 1250");
  });

  describe("when the schedule fires", () => {
    const fire = async (meterId: string, reading: number) => {
      await setReading(meterId, reading);
      const [loaded] = await recurringTasksRepository.findActiveMeterSchedules(meterId);

      return fireMeterSchedule(loaded, reading);
    };

    it("should mark the due-soon alert read, since the task now exists", async () => {
      await createManagerUser();
      const { meter, schedule } = await setup(980);
      await checkMeterDueSoon();

      const task = await fire(meter.id, 1000);

      expect(task).not.toBeNull();
      expect((await remindersFor(schedule.id)).every((r) => r.isRead)).toBe(true);
    });

    it("should leave it unread when an open task blocks the firing", async () => {
      await createManagerUser();
      const { meter, schedule } = await setup(980);
      await checkMeterDueSoon();
      const open = await createTestTask({ status: "OPEN" });
      await prisma.task.update({ where: { id: open.id }, data: { recurringTaskId: schedule.id } });

      const task = await fire(meter.id, 1000);

      expect(task).toBeNull();
      expect((await remindersFor(schedule.id)).some((r) => !r.isRead)).toBe(true);
    });

    it("should leave it unread when creating the task fails", async () => {
      await createManagerUser();
      const { meter, schedule } = await setup(980);
      await checkMeterDueSoon();
      jest.spyOn(tasksRepository, "createFromSchedule").mockRejectedValueOnce(new Error("boom"));

      await expect(fire(meter.id, 1000)).rejects.toThrow("boom");

      expect((await remindersFor(schedule.id)).some((r) => !r.isRead)).toBe(true);
    });

    it("should leave other schedules' alerts alone", async () => {
      await createManagerUser();
      const a = await setup(980);
      const b = await setup(980);
      await checkMeterDueSoon();

      await fire(a.meter.id, 1000);

      expect((await remindersFor(b.schedule.id)).some((r) => !r.isRead)).toBe(true);
    });
  });

  it("should skip paused schedules and time-based ones", async () => {
    await createManagerUser();
    const paused = await setup(980, { isActive: false });
    await createTestRecurringTask({ nextDueAt: new Date("2020-01-01T00:00:00.000Z") });

    await checkMeterDueSoon();

    expect(await remindersFor(paused.schedule.id)).toHaveLength(0);
    expect(await prisma.notification.count({ where: { type: "METER_SERVICE_DUE" } })).toBe(0);
  });

  it("should leave a schedule unmarked when everyone has muted the reminder, and retry later", async () => {
    const manager = await createManagerUser();
    await prisma.user.update({
      where: { id: manager.id },
      data: { notificationPreferences: { METER_SERVICE_DUE: false } },
    });
    const { schedule } = await setup(980);

    await checkMeterDueSoon();

    expect(await remindersFor(schedule.id)).toHaveLength(0);
    const stored = await prisma.recurringTask.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.reminderSentForReading).toBeNull();

    await prisma.user.update({ where: { id: manager.id }, data: { notificationPreferences: {} } });
    await checkMeterDueSoon();

    expect(await remindersFor(schedule.id)).toHaveLength(1);
  });

  it("should remind the other schedules, then fail the run, when one fails", async () => {
    await createManagerUser();
    const a = await setup(980);
    const b = await setup(980);
    jest.spyOn(notificationsService, "createMany").mockRejectedValueOnce(new Error("boom"));

    await expect(checkMeterDueSoon()).rejects.toThrow("1 of 2 meter schedules failed to remind");

    const sent =
      (await remindersFor(a.schedule.id)).length + (await remindersFor(b.schedule.id)).length;
    expect(sent).toBe(1);
  });

  it("should not fail on very large readings", async () => {
    await createManagerUser();
    const meter = await createTestMeter({ currentReading: 0 });
    await createTestMeterSchedule({
      meterId: meter.id,
      intervalReading: 25_000_000,
      firstDueReading: 25_000_000,
    });

    await expect(checkMeterDueSoon()).resolves.toBeUndefined();
  });

  it("should do nothing when there is nobody to notify", async () => {
    const { schedule } = await setup(980);

    await checkMeterDueSoon();

    expect(await remindersFor(schedule.id)).toHaveLength(0);
    const stored = await prisma.recurringTask.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.reminderSentForReading).toBeNull();
  });
});
