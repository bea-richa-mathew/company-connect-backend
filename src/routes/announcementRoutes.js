
import { Router } from "express";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from "../controllers/announcementController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.get("/", listAnnouncements);

router.post("/", protect, authorize("admin"), createAnnouncement);
router.patch("/:id", protect, authorize("admin"), updateAnnouncement);
router.delete("/:id", protect, authorize("admin"), deleteAnnouncement);

export default router;