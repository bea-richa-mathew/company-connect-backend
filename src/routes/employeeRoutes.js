
import { Router } from "express";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  getMyEmployeeProfile,
  updateMyProfile
} from "../controllers/employeeController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/me", authorize("employee"), getMyEmployeeProfile);
router.patch("/me", authorize("employee"), updateMyProfile);

router.get("/", authorize("admin"), listEmployees);
router.post("/", authorize("admin"), createEmployee);
router.get("/:id", authorize("admin"), getEmployee);
router.patch("/:id", authorize("admin"), updateEmployee);

export default router;