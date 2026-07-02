import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createQueue,
  listQueues,
  getQueue,
  updateQueue,
  deleteQueue,
  createQueueSchema,
} from "../controllers/queue.controller.js";
import { listTokens, addToken, assignNext, addTokenSchema } from "../controllers/token.controller.js";
import { queueAnalytics } from "../controllers/analytics.controller.js";

const router = Router();
router.use(protect);

router.post("/", validate(createQueueSchema), createQueue);
router.get("/", listQueues);
router.get("/:id", getQueue);
router.patch("/:id", updateQueue);
router.delete("/:id", deleteQueue);

router.get("/:id/tokens", listTokens);
router.post("/:id/tokens", validate(addTokenSchema), addToken);
router.post("/:id/assign-next", assignNext);

router.get("/:id/analytics", queueAnalytics);

export default router;
