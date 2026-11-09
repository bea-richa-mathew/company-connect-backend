import { Router } from "express";

import {
  protect,
  authorize,
} from "../middleware/auth.js";

import {
  taskSubmissionUpload,
} from "../middleware/taskSubmissionUpload.js";

import {
  listTaskSubmissions,
  submitTaskWork,
  reviewTaskSubmission,
  downloadTaskSubmission,
} from "../controllers/taskSubmissionController.js";

const router = Router();

router.use(protect);

router.get(
  "/:taskId/submissions",
  authorize("admin", "employee"),
  listTaskSubmissions
);

router.post(
  "/:taskId/submissions",
  authorize("employee"),
  (req, res, next) => {
    taskSubmissionUpload(
      req,
      res,
      (error) => {
        if (error) {
          return res.status(400).json({
            success: false,
            message: error.message,
          });
        }

        next();
      }
    );
  },
  submitTaskWork
);

router.patch(
  "/:taskId/submissions/:submissionId/review",
  authorize("admin"),
  reviewTaskSubmission
);

router.get(
  "/:taskId/submissions/:submissionId/download",
  authorize("admin", "employee"),
  downloadTaskSubmission
);

export default router;