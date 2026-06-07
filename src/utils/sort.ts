/**
 * Resolves a client-provided sortBy value against a whitelist.
 * Returns the default if the value is not in the allowed list.
 * Prevents unexpected DB behavior from unwhitelisted sort fields.
 */
export const resolveSortField = <T extends string>(
  sortBy: string,
  allowedFields: readonly T[],
  defaultField: T,
): T => (allowedFields.includes(sortBy as T) ? (sortBy as T) : defaultField);
