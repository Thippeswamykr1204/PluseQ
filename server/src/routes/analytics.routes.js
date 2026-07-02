import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { overviewAnalytics } from "../controllers/analytics.controller.js";

const router = Router();
router.use(protect);

router.get("/overview", overviewAnalytics);

export default router;
