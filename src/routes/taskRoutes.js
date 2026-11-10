import { Router } from "express";

import {
  listTasks,
  createTask,
  updateTask,
} from "../controllers/taskController.js";

import {
  protect,
  authorize,
} from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get(
  "/",
  authorize("admin", "employee"),
  listTasks
);

router.post(
  "/",
  authorize("admin"),
  createTask
);

router.patch(
  "/:id",
  authorize("admin", "employee"),
  updateTask
);

export default router;