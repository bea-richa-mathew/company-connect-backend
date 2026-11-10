
import { Router } from "express";
import {
  createApplication,
  listApplications,
  getMyApplications,
  updateApplication
} from "../controllers/applicationController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/", createApplication);
router.get("/my", protect, getMyApplications);
router.get("/", protect, authorize("admin"), listApplications);
router.patch("/:id", protect, authorize("admin"), updateApplication);

export default router;