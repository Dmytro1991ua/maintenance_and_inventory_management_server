/**
 * Base class for all operational errors.
 *
 * Operational errors = expected failures we handle deliberately:
 *   wrong password, missing resource, invalid input, no permission.
 *
 * Non-operational errors = unexpected crashes:
 *   null reference, DB connection lost, out of memory.
 *
 * The global error handler uses isOperational to decide:
 *   - operational  → log as warning, return 4xx with safe message
 *   - non-operational → log as error, return 500 with generic message
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Required when extending built-in classes in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);

    // Exclude the constructor itself from the stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}
