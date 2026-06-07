import { ALLOWED_SORT_FIELDS, DEFAULT_SORT_FIELD } from "./users.constants";
import { SortField } from "./users.types";

export const resolveSortField = (sortBy: string): SortField =>
  ALLOWED_SORT_FIELDS.includes(sortBy as SortField) ? (sortBy as SortField) : DEFAULT_SORT_FIELD;
