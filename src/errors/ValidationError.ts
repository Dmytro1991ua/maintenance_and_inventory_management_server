import { AppError } from "./AppError";

// 400 — request body or params failed schema validation
export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
  }
}
