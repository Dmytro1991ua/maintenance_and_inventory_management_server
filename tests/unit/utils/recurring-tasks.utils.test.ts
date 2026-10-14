import {
  buildMeterTaskDescription,
  nextGridThreshold,
} from "../../../src/modules/recurring-tasks/recurring-tasks.utils";

describe("nextGridThreshold", () => {
  // Anchor 1250, interval 250 → thresholds 1250, 1500, 1750, 2000, ...
  it.each([
    ["a reading below the first threshold", 1240, 1250],
    ["a reading well below the first threshold", 0, 1250],
    ["a reading exactly at a threshold moves to the next one", 1250, 1500],
    ["a reading just past a threshold", 1251, 1500],
    ["a reading just below the next threshold", 1499, 1500],
    ["a reading that overshoots one threshold skips ahead", 1600, 1750],
    ["a reading that overshoots several thresholds skips them all", 2600, 2750],
  ])("should return the first grid point above %s", (_label, reading, expected) => {
    expect(nextGridThreshold(1250, 250, reading)).toBe(expected);
  });

  it("should stay on the original grid rather than drifting by the reading", () => {
    // Reading + interval would give 1850; the grid says 1750.
    expect(nextGridThreshold(1250, 250, 1600)).toBe(1750);
  });

  it("should handle an interval of 1", () => {
    expect(nextGridThreshold(10, 1, 10)).toBe(11);
    expect(nextGridThreshold(10, 1, 25)).toBe(26);
  });

  it("should handle a first threshold of 0", () => {
    expect(nextGridThreshold(0, 100, 0)).toBe(100);
    expect(nextGridThreshold(0, 100, 99)).toBe(100);
    expect(nextGridThreshold(0, 100, 100)).toBe(200);
  });

  it("should always return a threshold strictly above the reading once past the anchor", () => {
    for (let reading = 1250; reading < 3000; reading += 37) {
      const next = nextGridThreshold(1250, 250, reading);

      expect(next).toBeGreaterThan(reading);
      expect((next - 1250) % 250).toBe(0);
    }
  });
});

describe("buildMeterTaskDescription", () => {
  const meter = { name: "Engine hours", unit: "hours" };

  it("should explain what triggered the task", () => {
    expect(buildMeterTaskDescription(null, meter, 1255, 1250)).toBe(
      "Triggered by meter: Engine hours reached 1255 hours (due at 1250).",
    );
  });

  it("should append the trigger to the schedule's own description", () => {
    expect(buildMeterTaskDescription("Use 5W-30.", meter, 1255, 1250)).toBe(
      "Use 5W-30.\n\nTriggered by meter: Engine hours reached 1255 hours (due at 1250).",
    );
  });
});
