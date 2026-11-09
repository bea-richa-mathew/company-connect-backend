
import { Router } from "express";
import mongoose from "mongoose";

import Task from "../models/Task.js";

import {
  protect,
  authorize
} from "../middleware/auth.js";

import {
  uploadTaskAttachment
} from "../middleware/taskUpload.js";

import {
  listTaskAttachments,
  addTaskAttachment,
  downloadTaskAttachment,
  deleteTaskAttachment
} from "../controllers/taskAttachmentController.js";

const router = Router();

router.use(protect);
router.use(authorize("admin", "employee"));

async function checkTaskAccess(req, res, next) {
  try {
    const { taskId } = req.params;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID"
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    const isAdmin = req.user.role === "admin";

    const isAssignedEmployee =
      String(task.assignedTo) === String(req.user.id);

    if (!isAdmin && !isAssignedEmployee) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    req.attachmentTask = task;
    next();
  } catch (error) {
    next(error);
  }
}

router.get(
  "/:taskId/attachments",
  checkTaskAccess,
  listTaskAttachments
);

router.post(
  "/:taskId/attachments",
  authorize("admin"),
  checkTaskAccess,
  (req, res, next) => {
    uploadTaskAttachment(req, res, (error) => {
      if (error) {
        return res.status(
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400
        ).json({
          success: false,
          message: error.message
        });
      }

      next();
    });
  },
  addTaskAttachment
);

router.get(
  "/:taskId/attachments/:attachmentId/download",
  checkTaskAccess,
  downloadTaskAttachment
);

router.delete(
  "/:taskId/attachments/:attachmentId",
  authorize("admin"),
  checkTaskAccess,
  deleteTaskAttachment
);

export default router;
