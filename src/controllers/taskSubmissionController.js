import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

import Task from "../models/Task.js";
import TaskSubmission from "../models/TaskSubmission.js";

import {
  uploadDir,
} from "../middleware/taskSubmissionUpload.js";

import {
  logActivitySafely,
} from "../services/activityService.js";

async function removeUploadedFile(req) {
  if (req.file?.path) {
    await fs.unlink(req.file.path).catch(() => {});
  }
}

async function authorizedTask(req, res) {
  if (!mongoose.isValidObjectId(req.params.taskId)) {
    res.status(400).json({
      success: false,
      message: "Invalid task ID",
    });
    return null;
  }

  const task = await Task.findById(
    req.params.taskId
  );

  if (!task) {
    res.status(404).json({
      success: false,
      message: "Task not found",
    });
    return null;
  }

  if (
    req.user.role !== "admin" &&
    String(task.assignedTo) !== String(req.user.id)
  ) {
    res.status(403).json({
      success: false,
      message: "Access denied",
    });
    return null;
  }

  return task;
}

export async function listTaskSubmissions(req, res) {
  try {
    const task = await authorizedTask(req, res);

    if (!task) return;

    const submissions = await TaskSubmission.find({
      task: task._id,
    })
      .populate(
        "submittedBy",
        "name email employeeId"
      )
      .populate("reviewedBy", "name")
      .sort({
        createdAt: -1,
        _id: -1,
      });

    return res.json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error("listTaskSubmissions:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load submissions",
    });
  }
}

export async function submitTaskWork(req, res) {
  let session;

  try {
    const task = await authorizedTask(req, res);

    if (!task) {
      await removeUploadedFile(req);
      return;
    }

    if (req.user.role !== "employee") {
      await removeUploadedFile(req);

      return res.status(403).json({
        success: false,
        message: "Employee access required",
      });
    }

    const note =
      typeof req.body.note === "string"
        ? req.body.note.trim()
        : "";

    if (!note && !req.file) {
      return res.status(400).json({
        success: false,
        message: "Add a completion note or file",
      });
    }

    if (note.length > 10000) {
      await removeUploadedFile(req);

      return res.status(400).json({
        success: false,
        message:
          "Note must be 10000 characters or fewer",
      });
    }

    session = await mongoose.startSession();

    let submission;

    await session.withTransaction(async () => {
      const updated = await Task.findOneAndUpdate(
        {
          _id: task._id,
          status: { $ne: "Completed" },
          reviewStatus: {
            $ne: "Pending Review",
          },
        },
        {
          $set: {
            status: "In Progress",
            reviewStatus: "Pending Review",
            submittedAt: new Date(),
            reviewedAt: null,
            reviewedBy: null,
            reviewComment: "",
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!updated) {
        const conflict = new Error(
          "Task is completed or already pending review"
        );

        conflict.status = 409;
        throw conflict;
      }

      [submission] = await TaskSubmission.create(
        [
          {
            task: task._id,
            submittedBy: req.user.id,
            note,
            ...(req.file
              ? {
                  file: {
                    originalName:
                      req.file.originalname,
                    storedName:
                      req.file.filename,
                    mimeType:
                      req.file.mimetype,
                    size:
                      req.file.size,
                  },
                }
              : {}),
          },
        ],
        { session }
      );
    });

    await logActivitySafely({
      actor: req.user.id,
      action: "TASK_SUBMITTED",
      entityType: "Task",
      entityId: task._id,
      description:
        `Submitted work for task: ${task.title}`,
      metadata: {
        submissionId: submission._id,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: "Work submitted for review",
      data: submission,
    });
  } catch (error) {
    await removeUploadedFile(req);

    console.error("submitTaskWork:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Unable to submit task",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function reviewTaskSubmission(req, res) {
  let session;

  try {
    const task = await authorizedTask(req, res);

    if (!task) return;

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    if (
      !mongoose.isValidObjectId(
        req.params.submissionId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    const {
      decision,
      comment = "",
    } = req.body;

    if (
      ![
        "approve",
        "request_changes",
      ].includes(decision)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid review decision",
      });
    }

    if (
      typeof comment !== "string" ||
      comment.length > 10000 ||
      (
        decision === "request_changes" &&
        !comment.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Feedback is required for changes (max 10000 characters)",
      });
    }

    const nextReview =
      decision === "approve"
        ? "Approved"
        : "Changes Requested";

    const now = new Date();

    session = await mongoose.startSession();

    let updatedTask;
    let updatedSubmission;

    await session.withTransaction(async () => {
      updatedSubmission =
        await TaskSubmission.findOneAndUpdate(
          {
            _id: req.params.submissionId,
            task: task._id,
            status: "Pending Review",
          },
          {
            $set: {
              status: nextReview,
              reviewComment: comment.trim(),
              reviewedAt: now,
              reviewedBy: req.user.id,
            },
          },
          {
            new: true,
            session,
          }
        );

      if (!updatedSubmission) {
        const conflict = new Error(
          "Submission was already reviewed or does not exist"
        );

        conflict.status = 409;
        throw conflict;
      }

      updatedTask = await Task.findOneAndUpdate(
        {
          _id: task._id,
          reviewStatus: "Pending Review",
        },
        {
          $set: {
            status:
              decision === "approve"
                ? "Completed"
                : "In Progress",
            reviewStatus: nextReview,
            reviewComment: comment.trim(),
            reviewedAt: now,
            reviewedBy: req.user.id,
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedTask) {
        const conflict = new Error(
          "Task is no longer pending review"
        );

        conflict.status = 409;
        throw conflict;
      }
    });

    await logActivitySafely({
      actor: req.user.id,
      action:
        decision === "approve"
          ? "TASK_APPROVED"
          : "TASK_CHANGES_REQUESTED",
      entityType: "Task",
      entityId: task._id,
      description:
        decision === "approve"
          ? `Approved task: ${task.title}`
          : `Requested changes for task: ${task.title}`,
      metadata: {
        submissionId: updatedSubmission._id,
        comment: comment.trim(),
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message:
        decision === "approve"
          ? "Task approved"
          : "Changes requested",
      data: {
        task: updatedTask,
        submission: updatedSubmission,
      },
    });
  } catch (error) {
    console.error("reviewTaskSubmission:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Unable to review submission",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

export async function downloadTaskSubmission(req, res) {
  try {
    const task = await authorizedTask(req, res);

    if (!task) return;

    if (
      !mongoose.isValidObjectId(
        req.params.submissionId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    const submission =
      await TaskSubmission.findOne({
        _id: req.params.submissionId,
        task: task._id,
      });

    if (!submission?.file?.storedName) {
      return res.status(404).json({
        success: false,
        message: "No file attached",
      });
    }

    const filePath = path.join(
      uploadDir,
      path.basename(submission.file.storedName)
    );

    await fs.access(filePath);

    return res.download(
      filePath,
      submission.file.originalName
    );
  } catch (error) {
    console.error(
      "downloadTaskSubmission:",
      error
    );

    if (!res.headersSent) {
      return res.status(404).json({
        success: false,
        message: "File unavailable",
      });
    }
  }
}