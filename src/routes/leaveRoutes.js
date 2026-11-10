import { Router } from "express";

import {
  listLeaves,
  createLeave,
  reviewLeave,
} from "../controllers/leaveController.js";

import {
  protect,
  authorize,
} from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get(
  "/",
  authorize("admin", "employee"),
  listLeaves
);

router.post(
  "/",
  authorize("employee"),
  createLeave
);

router.patch(
  "/:id/review",
  authorize("admin"),
  reviewLeave
);

export default router;