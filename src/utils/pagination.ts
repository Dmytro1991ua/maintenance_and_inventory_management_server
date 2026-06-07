/**
 * Calculates the number of records to skip for offset pagination.
 * Used in Prisma's `skip` option.
 *
 * Example: page 3, limit 20 → skip 40
 */
export const getSkipValue = (page: number, limit: number): number => (page - 1) * limit;

/**
 * Calculates total number of pages.
 * Guards against division by zero if limit is somehow 0.
 *
 * Example: total 95, limit 20 → 5 pages
 */
export const getTotalPages = (total: number, limit: number): number => {
  if (limit <= 0) return 0;

  return Math.ceil(total / limit);
};
