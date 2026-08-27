import { prisma } from "../../config";
import { getSkipValue, getTotalPages, resolveSortField } from "../../utils";
import {
  ASSET_ENTITY_ALLOWED_SORT_FIELDS,
  ASSET_ENTITY_DEFAULT_SORT_FIELD,
  ASSET_SELECT,
} from "./assets.constants";
import type { AssetsQuery, CreateAsset, UpdateAsset } from "./assets.schemas";
import { buildAssetsWhere } from "./assets.utils";

export const assetsRepository = {
  findAll: async (query: AssetsQuery) => {
    const { page, limit, sortBy, sortOrder, search, category, status } = query;

    const field = resolveSortField(
      sortBy,
      ASSET_ENTITY_ALLOWED_SORT_FIELDS,
      ASSET_ENTITY_DEFAULT_SORT_FIELD,
    );
    const skip = getSkipValue(page, limit);
    const where = buildAssetsWhere(search, category, status);

    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        select: ASSET_SELECT,
        orderBy: { [field]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: assets,
      meta: { total, page, limit, pages: getTotalPages(total, limit) },
    };
  },
  findById: async (id: string) =>
    prisma.asset.findUnique({
      where: { id },
      select: ASSET_SELECT,
    }),
  findBySerialNumber: async (serialNumber: string) =>
    prisma.asset.findUnique({
      where: { serialNumber },
      select: { id: true },
    }),
  getStats: async () => {
    type CategoryRow = {
      category: string;
      total: number;
      operational: number;
      down: number;
      retired: number;
    };

    const rows = await prisma.$queryRaw<CategoryRow[]>`
      SELECT
        category::text,
        (COUNT(*))::int                                             AS total,
        (COUNT(*) FILTER (WHERE status = 'OPERATIONAL'))::int       AS operational,
        (COUNT(*) FILTER (WHERE status = 'DOWN'))::int              AS down,
        (COUNT(*) FILTER (WHERE status = 'RETIRED'))::int           AS retired
      FROM assets
      GROUP BY category
    `;

    const byCategory = Object.fromEntries(
      rows.map(({ category, ...counts }) => [category, counts]),
    );

    return {
      total: rows.reduce((s, r) => s + r.total, 0),
      operational: rows.reduce((s, r) => s + r.operational, 0),
      down: rows.reduce((s, r) => s + r.down, 0),
      retired: rows.reduce((s, r) => s + r.retired, 0),
      byCategory,
    };
  },
  create: async (data: CreateAsset) =>
    prisma.asset.create({
      data,
      select: ASSET_SELECT,
    }),
  update: async (id: string, data: UpdateAsset) =>
    prisma.asset.update({
      where: { id },
      data,
      select: ASSET_SELECT,
    }),
  delete: async (id: string): Promise<void> => {
    await prisma.asset.delete({ where: { id } });
  },
};
