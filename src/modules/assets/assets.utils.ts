import { Prisma } from "../../generated/prisma/client";
import type { AssetCategory, AssetStatus } from "./assets.schemas";

const normalizeSearch = (search?: string): string | undefined => {
  const normalizedSearch = search?.trim();

  return normalizedSearch || undefined;
};

/** Formats in UTC, not the server locale, so the stored calendar day never shifts. */
export const buildWarrantyExpiringMessage = (name: string, expiresAt: Date): string => {
  const formatted = expiresAt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `Warranty expiring: "${name}" is covered until ${formatted}.`;
};

/**
 * Builds the Prisma WHERE input for asset list queries.
 * Returns undefined when no filters are active so Prisma applies no WHERE filter.
 */
export const buildAssetsWhere = (
  search?: string,
  category?: AssetCategory,
  status?: AssetStatus,
): Prisma.AssetWhereInput | undefined => {
  const normalizedSearch = normalizeSearch(search);

  if (!normalizedSearch && !category && !status) return undefined;

  return {
    ...(category && { category }),
    ...(status && { status }),
    ...(normalizedSearch && {
      OR: [
        { name: { contains: normalizedSearch, mode: "insensitive" } },
        { serialNumber: { contains: normalizedSearch, mode: "insensitive" } },
        { location: { contains: normalizedSearch, mode: "insensitive" } },
      ],
    }),
  };
};
