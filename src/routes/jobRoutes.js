
import { Router } from "express";
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob
} from "../controllers/jobController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.get("/", listJobs);
router.get("/:id", getJob);

router.post("/", protect, authorize("admin"), createJob);
router.patch("/:id", protect, authorize("admin"), updateJob);
router.delete("/:id", protect, authorize("admin"), deleteJob);

export default router;