import { AppError } from "./AppError";

// 403 — authenticated but not authorised for this resource
export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN");
  }
}
