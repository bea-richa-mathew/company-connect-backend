
import { Router } from "express";
import {
  listAttendance,
  getTodayAttendance,
  attendanceSummary,
  checkIn,
  checkOut,
  adminRecordAttendance,
} from "../controllers/attendanceController.js";
import {
  protect,
  authorize,
} from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get(
  "/",
  authorize("admin", "employee"),
  listAttendance
);

router.get(
  "/today",
  authorize("admin", "employee"),
  getTodayAttendance
);

router.get(
  "/summary",
  authorize("admin", "employee"),
  attendanceSummary
);

router.post(
  "/check-in",
  authorize("employee"),
  checkIn
);

router.post(
  "/check-out",
  authorize("employee"),
  checkOut
);

router.post(
  "/record",
  authorize("admin"),
  adminRecordAttendance
);

export default router;
