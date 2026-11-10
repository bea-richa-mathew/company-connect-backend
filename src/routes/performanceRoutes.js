
import { Router } from "express";

import {
  protect,
  authorize
} from "../middleware/auth.js";

import {
  getEmployeePerformance,
  getOverallPerformance
} from "../controllers/performanceController.js";

const router = Router();

router.use(protect);
router.use(authorize("admin"));

router.get("/", getOverallPerformance);
router.get("/:employeeId", getEmployeePerformance);

export default router;
