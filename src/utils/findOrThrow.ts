import { NotFoundError } from "../errors";

/**
 * Runs a lookup and throws NotFoundError if it returns null/undefined,
 * otherwise returns the entity. Collapses the repeated
 * "fetch by id, 404 if missing" check used across service layers.
 */
export const findOrThrow = async <T>(
  find: () => Promise<T | null | undefined>,
  message: string,
): Promise<T> => {
  const entity = await find();

  if (!entity) throw new NotFoundError(message);

  return entity;
};
