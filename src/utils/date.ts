export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns a new Date offset from `date` by `days` (negative to go back).
 * Uses epoch-millis arithmetic — a fixed 24h day, matching how the rest of the
 * app reasons about day windows (due dates, reminder lead times, report ranges).
 */
export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);

/** Midnight (00:00 UTC) of the calendar day containing `date`. */
export const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/** The UTC calendar day as YYYY-MM-DD, ignoring time of day. */
export const toUtcDateString = (date: Date): string => date.toISOString().slice(0, 10);
