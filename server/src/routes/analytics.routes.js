import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { overviewAnalytics, todaySummary, recentActivity } from "../controllers/analytics.controller.js";

const router = Router();
router.use(protect);

router.get("/overview", overviewAnalytics);
router.get("/today", todaySummary);
router.get("/activity", recentActivity);

export default router;
