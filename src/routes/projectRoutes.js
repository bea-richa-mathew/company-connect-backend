
import express from "express";

import {
  projectAuth,
  projectAdminOnly
} from "../middleware/projectAuth.js";

import {
  getPublicProjects,
  getPublicProject,
  getAdminProjects,
  createProject,
  updateAdminProject,
  deleteProject,
  setProjectPermission,
  removeProjectEmployee,
  getEmployeeProjects,
  updateEmployeeProject,
  updateEmployeeProjectStatus,
  completeEmployeeProject,
  reviewProject
} from "../controllers/projectController.js";

import {
  getProjectEmailContact
} from "../controllers/projectEmailController.js";

const router = express.Router();

// Public
router.get("/", getPublicProjects);
router.get("/public/:slug", getPublicProject);

// Admin
router.get(
  "/admin",
  projectAuth,
  projectAdminOnly,
  getAdminProjects
);

router.post(
  "/admin",
  projectAuth,
  projectAdminOnly,
  createProject
);

router.patch(
  "/admin/:id",
  projectAuth,
  projectAdminOnly,
  updateAdminProject
);

router.delete(
  "/admin/:id",
  projectAuth,
  projectAdminOnly,
  deleteProject
);

router.patch(
  "/admin/:id/permissions",
  projectAuth,
  projectAdminOnly,
  setProjectPermission
);

router.delete(
  "/admin/:id/employees/:employeeId",
  projectAuth,
  projectAdminOnly,
  removeProjectEmployee
);

router.patch(
  "/admin/:id/review",
  projectAuth,
  projectAdminOnly,
  reviewProject
);

// Employee
router.get(
  "/employee",
  projectAuth,
  getEmployeeProjects
);

// New: email contact for an assigned project.
router.get(
  "/employee/:id/email-contact",
  projectAuth,
  getProjectEmailContact
);

router.patch(
  "/employee/:id",
  projectAuth,
  updateEmployeeProject
);

router.patch(
  "/employee/:id/status",
  projectAuth,
  updateEmployeeProjectStatus
);

router.patch(
  "/employee/:id/complete",
  projectAuth,
  completeEmployeeProject
);

export default router;
