import { randomUUID } from "node:crypto";

import { prisma } from "../../../src/config";
import type { Asset, AssetCategory, AssetStatus } from "../../../src/generated/prisma/client";

type CreateTestAssetOptions = {
  name?: string;
  serialNumber?: string;
  category?: AssetCategory;
  location?: string;
  status?: AssetStatus;
  manufacturer?: string | null;
  model?: string | null;
  installDate?: Date | null;
};

export const createTestAsset = (options: CreateTestAssetOptions = {}): Promise<Asset> => {
  const unique = randomUUID().slice(0, 8);

  return prisma.asset.create({
    data: {
      name: options.name ?? "Rooftop HVAC Unit",
      serialNumber: options.serialNumber ?? `AST-${unique}`,
      category: options.category ?? "HVAC",
      location: options.location ?? "Building A — Roof",
      status: options.status ?? "OPERATIONAL",
      manufacturer: options.manufacturer ?? null,
      model: options.model ?? null,
      installDate: options.installDate ?? null,
    },
  });
};
