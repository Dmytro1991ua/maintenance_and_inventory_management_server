import { assetsRepository } from "../../../src/modules/assets/assets.repository";
import { addDays, startOfUtcDay } from "../../../src/utils/date";
import { createTestAsset } from "../helpers";

const LEAD_DAYS = 30;

// Calendar dates relative to today (UTC midnight), so the suite doesn't rot.
const today = () => startOfUtcDay(new Date());
const inDays = (days: number) => addDays(today(), days);

const expiringIds = async () =>
  (await assetsRepository.findWarrantyExpiring(LEAD_DAYS)).map((asset) => asset.id).sort();

describe("assetsRepository.findWarrantyExpiring", () => {
  it("should include warranties expiring today, inside the window, and exactly at its end", async () => {
    const expiresToday = await createTestAsset({ warrantyExpiresAt: inDays(0) });
    const inside = await createTestAsset({ warrantyExpiresAt: inDays(10) });
    const atEnd = await createTestAsset({ warrantyExpiresAt: inDays(LEAD_DAYS) });

    expect(await expiringIds()).toEqual([expiresToday.id, inside.id, atEnd.id].sort());
  });

  it("should exclude warranties already expired and ones beyond the window", async () => {
    await createTestAsset({ warrantyExpiresAt: inDays(-1) }); // expired yesterday
    await createTestAsset({ warrantyExpiresAt: inDays(LEAD_DAYS + 1) }); // too far out
    const inside = await createTestAsset({ warrantyExpiresAt: inDays(5) });

    expect(await expiringIds()).toEqual([inside.id]);
  });

  it("should exclude assets with no warranty recorded", async () => {
    await createTestAsset({ warrantyExpiresAt: null });

    expect(await expiringIds()).toEqual([]);
  });

  it("should exclude RETIRED assets but keep DOWN ones", async () => {
    await createTestAsset({ status: "RETIRED", warrantyExpiresAt: inDays(5) });
    const down = await createTestAsset({ status: "DOWN", warrantyExpiresAt: inDays(5) });
    const operational = await createTestAsset({
      status: "OPERATIONAL",
      warrantyExpiresAt: inDays(5),
    });

    expect(await expiringIds()).toEqual([down.id, operational.id].sort());
  });

  it("should exclude assets that were already reminded", async () => {
    await createTestAsset({ warrantyExpiresAt: inDays(5), warrantyReminderSentAt: new Date() });
    const pending = await createTestAsset({ warrantyExpiresAt: inDays(5) });

    expect(await expiringIds()).toEqual([pending.id]);
  });

  it("should return the expiry date and order soonest-first", async () => {
    const later = await createTestAsset({ warrantyExpiresAt: inDays(20) });
    const sooner = await createTestAsset({ warrantyExpiresAt: inDays(3) });

    const result = await assetsRepository.findWarrantyExpiring(LEAD_DAYS);

    expect(result.map((asset) => asset.id)).toEqual([sooner.id, later.id]);
    expect(result[0].warrantyExpiresAt.getTime()).toBe(inDays(3).getTime());
  });
});

describe("assetsRepository.markWarrantyReminded", () => {
  it("should stop reminded assets appearing in later runs", async () => {
    const reminded = await createTestAsset({ warrantyExpiresAt: inDays(5) });
    const untouched = await createTestAsset({ warrantyExpiresAt: inDays(6) });

    await assetsRepository.markWarrantyReminded([reminded.id]);

    expect(await expiringIds()).toEqual([untouched.id]);
  });
});
