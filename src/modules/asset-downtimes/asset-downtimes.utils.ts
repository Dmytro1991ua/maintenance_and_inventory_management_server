import type { Prisma } from "../../generated/prisma/client";
import { DowntimeReason } from "../../generated/prisma/client";
import type { DOWNTIME_SELECT } from "./asset-downtimes.constants";

type DowntimeRow = Prisma.AssetDowntimeGetPayload<{ select: typeof DOWNTIME_SELECT }>;

const MS_PER_MINUTE = 60_000;

const minutesBetween = (from: Date, to: Date): number =>
  Math.max(0, (to.getTime() - from.getTime()) / MS_PER_MINUTE);

// An ongoing event counts up to `now`.
export const mapDowntime = (event: DowntimeRow, now: Date) => ({
  ...event,
  durationMinutes: Math.round(minutesBetween(event.startedAt, event.endedAt ?? now)),
});

// Downtime inside [from, to]: an event counts only the part that overlaps the window.
// The window ends at `now` at the latest, so the future is not counted as uptime.
export const summarizeDowntime = (events: DowntimeRow[], from: Date, to: Date, now: Date) => {
  const end = to < now ? to : now;
  const windowMinutes = minutesBetween(from, end);

  const overlap = (e: DowntimeRow): number => {
    const start = e.startedAt > from ? e.startedAt : from;
    const stop = e.endedAt ?? now;

    return minutesBetween(start, stop < end ? stop : end);
  };

  const sumFor = (reason: DowntimeReason) =>
    events.filter((e) => e.reason === reason).reduce((sum, e) => sum + overlap(e), 0);

  const breakdownMinutes = sumFor(DowntimeReason.BREAKDOWN);
  const plannedMinutes = sumFor(DowntimeReason.PLANNED);
  const downtimeMinutes = breakdownMinutes + plannedMinutes;

  // Breakdowns that started in the window; only finished ones have a repair time.
  const breakdowns = events.filter(
    (e) => e.reason === DowntimeReason.BREAKDOWN && e.startedAt >= from && e.startedAt <= end,
  );
  const repaired = breakdowns.filter((e) => e.endedAt);
  const repairMinutes = repaired.reduce(
    (sum, e) => sum + minutesBetween(e.startedAt, e.endedAt as Date),
    0,
  );

  return {
    windowMinutes: Math.round(windowMinutes),
    downtimeMinutes: Math.round(downtimeMinutes),
    breakdownMinutes: Math.round(breakdownMinutes),
    plannedMinutes: Math.round(plannedMinutes),
    breakdowns: breakdowns.length,
    availabilityPercent:
      windowMinutes > 0 ? Math.round((1 - downtimeMinutes / windowMinutes) * 10000) / 100 : null,
    mttrMinutes: repaired.length ? Math.round(repairMinutes / repaired.length) : null,
    mtbfMinutes: breakdowns.length
      ? Math.round((windowMinutes - downtimeMinutes) / breakdowns.length)
      : null,
  };
};
