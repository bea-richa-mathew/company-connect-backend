
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

import Task from "../models/Task.js";
import TaskAttachment from "../models/TaskAttachment.js";

import {
  taskUploadDirectory
} from "../middleware/taskUpload.js";

import {
  logActivitySafely
} from "../services/activityService.js";

async function getAuthorizedTask(req, res) {
  if (req.attachmentTask) {
    return req.attachmentTask;
  }

  const { taskId } = req.params;

  if (!mongoose.isValidObjectId(taskId)) {
    res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
    return null;
  }

  const task = await Task.findById(taskId);

  if (!task) {
    res.status(404).json({
      success: false,
      message: "Task not found"
    });
    return null;
  }

  if (
    req.user.role !== "admin" &&
    String(task.assignedTo) !== String(req.user.id)
  ) {
    res.status(403).json({
      success: false,
      message: "Access denied"
    });
    return null;
  }

  return task;
}

function getAttachmentPath(storedName) {
  return path.join(
    taskUploadDirectory,
    path.basename(storedName)
  );
}

async function removeFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("File cleanup failed:", error);
    }
  }
}

export async function listTaskAttachments(req, res) {
  const task = await getAuthorizedTask(req, res);

  if (!task) return;

  const attachments = await TaskAttachment.find({
    task: task._id
  })
    .populate("uploadedBy", "name")
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    data: attachments
  });
}

export async function addTaskAttachment(req, res) {
  const task = await getAuthorizedTask(req, res);

  if (!task) {
    if (req.file) {
      await removeFile(req.file.path);
    }
    return;
  }

  if (req.user.role !== "admin") {
    if (req.file) {
      await removeFile(req.file.path);
    }

    return res.status(403).json({
      success: false,
      message: "Only admins can upload attachments"
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please select a file"
    });
  }

  try {
    const attachment = await TaskAttachment.create({
      task: task._id,
      uploadedBy: req.user.id,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    await logActivitySafely({
      actor: req.user.id,
      action: "TASK_ATTACHMENT_UPLOADED",
      entityType: "Task",
      entityId: task._id,
      description: `Uploaded attachment to ${task.title}`,
      metadata: {
        attachmentId: attachment._id,
        filename: attachment.originalName
      },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: "Attachment uploaded successfully",
      data: attachment
    });
  } catch (error) {
    await removeFile(req.file.path);
    throw error;
  }
}

export async function downloadTaskAttachment(req, res) {
  const task = await getAuthorizedTask(req, res);

  if (!task) return;

  if (!mongoose.isValidObjectId(req.params.attachmentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid attachment ID"
    });
  }

  const attachment = await TaskAttachment.findOne({
    _id: req.params.attachmentId,
    task: task._id
  });

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: "Attachment not found"
    });
  }

  const filePath = getAttachmentPath(
    attachment.storedName
  );

  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({
      success: false,
      message: "Attachment file is missing from storage"
    });
  }

  return res.download(
    filePath,
    attachment.originalName
  );
}

export async function deleteTaskAttachment(req, res) {
  const task = await getAuthorizedTask(req, res);

  if (!task) return;

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only admins can delete attachments"
    });
  }

  if (!mongoose.isValidObjectId(req.params.attachmentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid attachment ID"
    });
  }

  const attachment = await TaskAttachment.findOne({
    _id: req.params.attachmentId,
    task: task._id
  });

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: "Attachment not found"
    });
  }

  const filePath = getAttachmentPath(
    attachment.storedName
  );

  await TaskAttachment.deleteOne({
    _id: attachment._id
  });

  await removeFile(filePath);

  await logActivitySafely({
    actor: req.user.id,
    action: "TASK_ATTACHMENT_DELETED",
    entityType: "Task",
    entityId: task._id,
    description: `Deleted attachment from ${task.title}`,
    metadata: {
      attachmentId: attachment._id,
      filename: attachment.originalName
    },
    ipAddress: req.ip
  });

  return res.json({
    success: true,
    message: "Attachment deleted successfully"
  });
}
