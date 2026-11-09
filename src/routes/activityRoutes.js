
import { Router } from "express";
import {
  protect,
  authorize
} from "../middleware/auth.js";

import {
  getActivityLogs
} from "../controllers/activityController.js";

const router = Router();

router.use(protect);
router.use(authorize("admin"));

router.get("/", getActivityLogs);

export default router;
