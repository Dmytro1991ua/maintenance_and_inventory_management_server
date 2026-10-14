/**
 * The first threshold above `reading` on the grid `anchor + k × interval`.
 * Anchored, so it doesn't drift; overshoots skip ahead, with no backlog.
 * E.g. anchor 1250, interval 250: reading 1250 gives 1500, 1600 gives 1750.
 */
export const nextGridThreshold = (anchor: number, interval: number, reading: number): number =>
  reading < anchor ? anchor : anchor + (Math.floor((reading - anchor) / interval) + 1) * interval;

/** The task description for a meter-triggered task: the schedule's own text, plus what fired it. */
export const buildMeterTaskDescription = (
  description: string | null,
  meter: { name: string; unit: string },
  reading: number,
  threshold: number,
): string => {
  const trigger = `Triggered by meter: ${meter.name} reached ${reading} ${meter.unit} (due at ${threshold}).`;

  return description ? `${description}\n\n${trigger}` : trigger;
};
