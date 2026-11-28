import { isDeepStrictEqual } from "node:util";

import { ChangeLogAction, ChangeLogEntity, Prisma } from "../../generated/prisma/client";
import { AUDITED_FIELDS, MONEY_FIELDS } from "./change-log.constants";

type Row = Record<string, unknown>;
type JsonValue = string | number | boolean | null | JsonValue[];

export type FieldChange = { field: string; oldValue: JsonValue; newValue: JsonValue };

const normalize = (field: string, value: unknown): JsonValue => {
  if (value === null || value === undefined) return null;
  if (MONEY_FIELDS.has(field)) return new Prisma.Decimal(String(value)).toFixed(2);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalize(field, item));
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  throw new Error(`Cannot record a ${typeof value} value for "${field}"`);
};

// `after` is the data being saved, not the returned row, which may omit audited fields.
export const buildChanges = (
  entityType: ChangeLogEntity,
  action: ChangeLogAction,
  before: Row | null,
  after: Row | null,
): FieldChange[] => {
  const source = action === ChangeLogAction.DELETE ? before : after;

  return AUDITED_FIELDS[entityType]
    .filter((field) => source?.[field] !== undefined)
    .map((field) => ({
      field,
      oldValue: normalize(field, before?.[field]),
      newValue: normalize(field, after?.[field]),
    }))
    .filter(({ oldValue, newValue }) => !isDeepStrictEqual(oldValue, newValue));
};
