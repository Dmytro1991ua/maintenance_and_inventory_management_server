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

  const totals = events.reduce(
    (acc, e) => {
      const minutes = overlap(e);

      if (e.reason === DowntimeReason.PLANNED) {
        acc.plannedMinutes += minutes;

        return acc;
      }

      acc.breakdownMinutes += minutes;

      // Only breakdowns that started in the window count; only finished ones have a repair time.
      if (e.startedAt >= from && e.startedAt <= end) {
        acc.breakdowns += 1;

        if (e.endedAt) {
          acc.repaired += 1;
          acc.repairMinutes += minutesBetween(e.startedAt, e.endedAt);
        }
      }

      return acc;
    },
    { breakdownMinutes: 0, plannedMinutes: 0, breakdowns: 0, repaired: 0, repairMinutes: 0 },
  );

  const { breakdownMinutes, plannedMinutes, breakdowns, repaired, repairMinutes } = totals;
  const downtimeMinutes = breakdownMinutes + plannedMinutes;

  return {
    windowMinutes: Math.round(windowMinutes),
    downtimeMinutes: Math.round(downtimeMinutes),
    breakdownMinutes: Math.round(breakdownMinutes),
    plannedMinutes: Math.round(plannedMinutes),
    breakdowns,
    availabilityPercent:
      windowMinutes > 0 ? Math.round((1 - downtimeMinutes / windowMinutes) * 10000) / 100 : null,
    mttrMinutes: repaired ? Math.round(repairMinutes / repaired) : null,
    mtbfMinutes: breakdowns ? Math.round((windowMinutes - downtimeMinutes) / breakdowns) : null,
  };
};
