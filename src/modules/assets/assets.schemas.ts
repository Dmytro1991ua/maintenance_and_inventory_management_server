import { z } from "zod";

import { ASSET_CATEGORIES, ASSET_STATUSES } from "./assets.constants";

export { ASSET_CATEGORIES };

export const AssetCategoryEnum = z.enum(ASSET_CATEGORIES);
export const AssetStatusEnum = z.enum(ASSET_STATUSES);

export const AssetsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    sortBy: z.enum(["name", "category", "status", "location", "createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().optional().openapi({ example: "pump" }),
    category: AssetCategoryEnum.optional(),
    status: AssetStatusEnum.optional(),
  })
  .openapi("AssetsQuery");

export const CreateAssetSchema = z
  .object({
    name: z
      .string()
      .min(1, { error: "Name is required" })
      .max(100)
      .openapi({ example: "Rooftop HVAC Unit #2" }),
    serialNumber: z
      .string()
      .min(1, { error: "Serial number is required" })
      .max(100)
      .openapi({ example: "HVAC-RTU-002" }),
    category: AssetCategoryEnum,
    location: z
      .string()
      .min(1, { error: "Location is required" })
      .max(150)
      .openapi({ example: "Building A — Roof" }),
    status: AssetStatusEnum.default("OPERATIONAL"),
    manufacturer: z.string().max(100).optional().openapi({ example: "Carrier" }),
    model: z.string().max(100).optional().openapi({ example: "48TCED12" }),
    installDate: z.coerce.date().optional().openapi({ example: "2021-06-15T00:00:00.000Z" }),
  })
  .openapi("CreateAssetInput");

export const UpdateAssetSchema = z
  .object({
    name: z.string().min(1, { error: "Name is required" }).max(100).optional(),
    category: AssetCategoryEnum.optional(),
    location: z.string().min(1, { error: "Location is required" }).max(150).optional(),
    status: AssetStatusEnum.optional(),
    manufacturer: z.string().max(100).nullable().optional(),
    model: z.string().max(100).nullable().optional(),
    installDate: z.coerce.date().nullable().optional(),
  })
  .strict()
  .openapi("UpdateAssetInput");

export const AssetIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid asset ID" }),
});

// — Response schemas — documentation only ——————————————————————————————————

export const AssetSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    serialNumber: z.string(),
    category: AssetCategoryEnum,
    location: z.string(),
    status: AssetStatusEnum,
    manufacturer: z.string().nullable(),
    model: z.string().nullable(),
    installDate: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Asset");

export const AssetResponseSchema = z
  .object({
    success: z.literal(true),
    data: AssetSchema,
  })
  .openapi("AssetResponse");

export const AssetListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(AssetSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("AssetListResponse");

export const AssetCategoriesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(AssetCategoryEnum),
  })
  .openapi("AssetCategoriesResponse");

const StatusStatsSchema = z.object({
  total: z.number().int(),
  operational: z.number().int(),
  down: z.number().int(),
  retired: z.number().int(),
});

export const AssetStatsResponseSchema = z
  .object({
    success: z.literal(true),
    data: StatusStatsSchema.extend({
      // Partial: getStats groups by category, so only categories with at least
      // one asset appear as keys — not all AssetCategory values.
      byCategory: z.partialRecord(AssetCategoryEnum, StatusStatsSchema),
    }),
  })
  .openapi("AssetStatsResponse");

export type AssetCategory = z.infer<typeof AssetCategoryEnum>;
export type AssetStatus = z.infer<typeof AssetStatusEnum>;
export type AssetsQuery = z.infer<typeof AssetsQuerySchema>;
export type CreateAsset = z.infer<typeof CreateAssetSchema>;
export type UpdateAsset = z.infer<typeof UpdateAssetSchema>;
export type AssetIdParam = z.infer<typeof AssetIdParamSchema>;
