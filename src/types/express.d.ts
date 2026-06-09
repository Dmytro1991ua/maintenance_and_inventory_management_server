import { Role } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        userName: string;
        roles: Role[];
      };
      requestId: string;
    }
  }
}
