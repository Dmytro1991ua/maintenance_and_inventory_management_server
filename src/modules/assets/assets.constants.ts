import { Prisma } from "../../generated/prisma/client";

export const ASSET_CATEGORIES = [
  "HVAC",
  "ELECTRICAL",
  "PLUMBING",
  "MECHANICAL",
  "VEHICLE",
  "IT_EQUIPMENT",
  "SAFETY_SYSTEM",
  "BUILDING",
] as const;

export const ASSET_STATUSES = ["OPERATIONAL", "DOWN", "RETIRED"] as const;

export const ASSET_SELECT = {
  id: true,
  name: true,
  serialNumber: true,
  category: true,
  location: true,
  status: true,
  manufacturer: true,
  model: true,
  installDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AssetSelect;

export const ASSET_ENTITY_ALLOWED_SORT_FIELDS = [
  "name",
  "category",
  "status",
  "location",
  "createdAt",
] as const;

export const ASSET_ENTITY_DEFAULT_SORT_FIELD = "createdAt" as const;

export const ASSET_NOT_FOUND_MESSAGE = "Asset not found";
