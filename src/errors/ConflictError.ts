import { AppError } from "./AppError";

// 409 — resource already exists (e.g. duplicate email on register)
export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}
