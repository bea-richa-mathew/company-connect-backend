
import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from "../controllers/notificationController.js";

const router = Router();

router.use(protect);
router.use(authorize("admin", "employee"));

router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;
