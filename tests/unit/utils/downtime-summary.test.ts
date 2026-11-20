import { summarizeDowntime } from "../../../src/modules/asset-downtimes/asset-downtimes.utils";

type Event = Parameters<typeof summarizeDowntime>[0][number];

const at = (iso: string) => new Date(iso);

const event = (
  reason: "BREAKDOWN" | "PLANNED",
  startedAt: string,
  endedAt: string | null,
): Event => ({
  id: "e",
  assetId: "a",
  taskId: null,
  reason,
  startedAt: at(startedAt),
  endedAt: endedAt ? at(endedAt) : null,
  note: null,
  createdAt: at(startedAt),
  creator: null,
});

// A 10-day window, 14400 minutes.
const FROM = at("2026-06-01T00:00:00Z");
const TO = at("2026-06-11T00:00:00Z");
const NOW = at("2026-07-01T00:00:00Z");

describe("summarizeDowntime", () => {
  it("should report full availability and no MTTR or MTBF with no events", () => {
    expect(summarizeDowntime([], FROM, TO, NOW)).toEqual({
      windowMinutes: 14400,
      downtimeMinutes: 0,
      breakdownMinutes: 0,
      plannedMinutes: 0,
      breakdowns: 0,
      availabilityPercent: 100,
      mttrMinutes: null,
      mtbfMinutes: null,
    });
  });

  it("should compute availability, MTTR and MTBF from breakdowns", () => {
    const events = [
      event("BREAKDOWN", "2026-06-02T00:00:00Z", "2026-06-02T02:00:00Z"), // 120 min
      event("BREAKDOWN", "2026-06-05T00:00:00Z", "2026-06-05T04:00:00Z"), // 240 min
    ];

    const summary = summarizeDowntime(events, FROM, TO, NOW);

    expect(summary).toMatchObject({
      downtimeMinutes: 360,
      breakdowns: 2,
      availabilityPercent: 97.5,
      mttrMinutes: 180,
      mtbfMinutes: 7020, // (14400 - 360) / 2
    });
  });

  it("should count planned downtime against availability but not as a failure", () => {
    const events = [event("PLANNED", "2026-06-03T00:00:00Z", "2026-06-03T06:00:00Z")];

    const summary = summarizeDowntime(events, FROM, TO, NOW);

    expect(summary).toMatchObject({
      plannedMinutes: 360,
      breakdownMinutes: 0,
      breakdowns: 0,
      mttrMinutes: null,
      mtbfMinutes: null,
    });
    expect(summary.availabilityPercent).toBe(97.5);
  });

  it("should count only the part of an event inside the window", () => {
    // Starts 60 min before the window, ends 30 min into it.
    const events = [event("BREAKDOWN", "2026-05-31T23:00:00Z", "2026-06-01T00:30:00Z")];

    const summary = summarizeDowntime(events, FROM, TO, NOW);

    expect(summary.downtimeMinutes).toBe(30);
    // It started before the window, so it is not one of this window's breakdowns.
    expect(summary.breakdowns).toBe(0);
  });

  it("should count an ongoing event up to the end of the window, with no repair time yet", () => {
    const events = [event("BREAKDOWN", "2026-06-10T00:00:00Z", null)];

    const summary = summarizeDowntime(events, FROM, TO, NOW);

    expect(summary).toMatchObject({ downtimeMinutes: 1440, breakdowns: 1, mttrMinutes: null });
  });

  it("should not count the future as uptime when the window ends after now", () => {
    const now = at("2026-06-06T00:00:00Z"); // halfway through
    const events = [event("BREAKDOWN", "2026-06-05T00:00:00Z", null)];

    const summary = summarizeDowntime(events, FROM, TO, now);

    expect(summary.windowMinutes).toBe(7200);
    expect(summary.downtimeMinutes).toBe(1440);
    expect(summary.availabilityPercent).toBe(80);
  });

  it("should give no availability for an empty window", () => {
    expect(summarizeDowntime([], FROM, FROM, NOW).availabilityPercent).toBeNull();
  });
});
