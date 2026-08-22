import { Router } from "express";

import { asyncHandler, authenticate } from "../../middleware";
import { dashboardController } from "./dashboard.controller";

const router = Router();

router.get("/stats", authenticate, asyncHandler(dashboardController.getStats));

export default router;
