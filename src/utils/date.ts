export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns a new Date offset from `date` by `days` (negative to go back).
 * Uses epoch-millis arithmetic — a fixed 24h day, matching how the rest of the
 * app reasons about day windows (due dates, reminder lead times, report ranges).
 */
export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);
