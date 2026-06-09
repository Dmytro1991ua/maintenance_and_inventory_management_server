export const DAILY_AT_MIDNIGHT = "0 0 * * *";

// Bounds how long a lock survives a crash mid-run. Comfortably larger than
// any of these jobs should ever take, yet far shorter than the 24h gap
// between runs — a stuck lock can never block the next scheduled run.
export const JOB_LOCK_TTL_MS = 10 * 60 * 1000;
