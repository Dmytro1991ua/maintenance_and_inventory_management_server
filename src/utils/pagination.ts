export const getTotalPages = (total: number, limit: number): number => {
  if (limit <= 0) return 0;

  return Math.ceil(total / limit);
};
