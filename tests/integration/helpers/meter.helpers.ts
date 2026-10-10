import { prisma } from "../../../src/config";
import type { Meter } from "../../../src/generated/prisma/client";
import { createTestAsset } from "./asset.helpers";

type CreateTestMeterOptions = {
  assetId?: string;
  name?: string;
  unit?: string;
  currentReading?: number;
};

// Creates a meter with its initial reading logged, matching what the API does,
// so currentReading and the log agree from the start.
export const createTestMeter = async (options: CreateTestMeterOptions = {}): Promise<Meter> => {
  const assetId = options.assetId ?? (await createTestAsset()).id;
  const currentReading = options.currentReading ?? 0;

  return prisma.meter.create({
    data: {
      assetId,
      name: options.name ?? "Engine hours",
      unit: options.unit ?? "hours",
      currentReading,
      lastReadingAt: new Date(),
      readings: { create: { value: currentReading } },
    },
  });
};
