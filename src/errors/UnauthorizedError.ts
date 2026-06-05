import { AppError } from "./AppError";

// 401 — no valid credentials provided (not logged in)
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}
