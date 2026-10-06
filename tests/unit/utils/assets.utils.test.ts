import { buildWarrantyExpiringMessage } from "../../../src/modules/assets/assets.utils";

describe("buildWarrantyExpiringMessage", () => {
  it("should name the asset and the expiry date", () => {
    expect(
      buildWarrantyExpiringMessage("Boiler — East Wing", new Date("2027-01-05T00:00:00.000Z")),
    ).toBe('Warranty expiring: "Boiler — East Wing" is covered until Jan 5, 2027.');
  });

  // Local-time formatting breaks on any non-UTC machine, in opposite directions:
  // west of UTC shifts a day-start back, east shifts a day-end forward. Testing
  // both instants catches either (setting process.env.TZ at runtime is unreliable).
  it("should show the UTC day for an instant at the very start of the day", () => {
    expect(buildWarrantyExpiringMessage("Pump", new Date("2026-11-14T00:00:00.000Z"))).toContain(
      "Nov 14, 2026",
    );
  });

  it("should show the UTC day for an instant at the very end of the day", () => {
    expect(buildWarrantyExpiringMessage("Pump", new Date("2026-11-14T23:30:00.000Z"))).toContain(
      "Nov 14, 2026",
    );
  });
});
