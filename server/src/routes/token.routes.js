import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { moveToken, completeToken, cancelToken } from "../controllers/token.controller.js";

const router = Router();
router.use(protect);

router.patch("/:tokenId/move", moveToken);
router.patch("/:tokenId/complete", completeToken);
router.delete("/:tokenId", cancelToken);

export default router;
