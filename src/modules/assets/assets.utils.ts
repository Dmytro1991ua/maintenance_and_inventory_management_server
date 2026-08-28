import { Prisma } from "../../generated/prisma/client";
import type { AssetCategory, AssetStatus } from "./assets.schemas";

const normalizeSearch = (search?: string): string | undefined => {
  const normalizedSearch = search?.trim();

  return normalizedSearch || undefined;
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
