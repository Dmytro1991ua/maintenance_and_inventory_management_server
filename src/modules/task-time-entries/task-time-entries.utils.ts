import { Prisma } from "../../generated/prisma/client";
import type { TIME_ENTRY_SELECT } from "./task-time-entries.constants";

type TimeEntryRow = Prisma.TaskTimeEntryGetPayload<{ select: typeof TIME_ENTRY_SELECT }>;

// Cost of one entry: minutes × the rate it was logged at, to the cent.
const entryCost = (minutes: number, rate: Prisma.Decimal | null): Prisma.Decimal | null =>
  rate ? rate.mul(minutes).div(60).toDecimalPlaces(2) : null;

// Rates and costs are only shown to ADMIN and MANAGER (includeCost).
export const mapTimeEntry = (entry: TimeEntryRow, includeCost: boolean) => {
  const { hourlyRate, workedOn, ...rest } = entry;
  const base = { ...rest, workedOn: workedOn.toISOString().slice(0, 10) };

  if (!includeCost) return base;

  return {
    ...base,
    hourlyRate: hourlyRate?.toFixed(2) ?? null,
    cost: entryCost(entry.minutes, hourlyRate)?.toFixed(2) ?? null,
  };
};

export const summarizeTimeEntries = (entries: TimeEntryRow[], includeCost: boolean) => {
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const summary = { entries: entries.map((e) => mapTimeEntry(e, includeCost)), totalMinutes };

  if (!includeCost) return summary;

  // The total adds the per-entry costs, so it always matches the rows shown.
  const totalCost = entries.reduce(
    (sum, e) => sum.add(entryCost(e.minutes, e.hourlyRate) ?? 0),
    new Prisma.Decimal(0),
  );
  const unratedMinutes = entries
    .filter((e) => e.hourlyRate === null)
    .reduce((sum, e) => sum + e.minutes, 0);

  return { ...summary, totalCost: totalCost.toFixed(2), unratedMinutes };
};
