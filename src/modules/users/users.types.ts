import { ALLOWED_SORT_FIELDS } from "./users.constants";

export type SortField = (typeof ALLOWED_SORT_FIELDS)[number];
