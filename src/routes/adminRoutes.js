
import { Router } from "express";
import {
  dashboard,
  statistics
} from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/dashboard", dashboard);
router.get("/stats", statistics);

export default router;