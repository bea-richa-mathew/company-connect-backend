
import Task from "../models/Task.js";
import User from "../models/User.js";

import {
  notifyTaskAssigned,
  runNotificationSafely,
} from "../services/notificationService.js";

import {
  logActivitySafely,
} from "../services/activityService.js";

export async function listTasks(req, res) {
  const filter =
    req.user.role === "admin"
      ? {}
      : { assignedTo: req.user.id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const tasks = await Task.find(filter)
    .populate(
      "assignedTo",
      "name email employeeId department"
    )
    .populate(
      "assignedBy",
      "name email"
    )
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    data: tasks,
  });
}

export async function createTask(req, res) {
  const { title, assignedTo } = req.body;

  if (!title || !assignedTo) {
    return res.status(400).json({
      success: false,
      message:
        "Task title and assigned employee are required",
    });
  }

  const employee = await User.findOne({
    _id: assignedTo,
    role: "employee",
    isActive: true,
  });

  if (!employee) {
    return res.status(400).json({
      success: false,
      message: "Active employee not found",
    });
  }

  const task = await Task.create({
    title,
    assignedTo,
    assignedBy: req.user.id,
    description: req.body.description || "",
    priority: req.body.priority || "Medium",
    dueDate: req.body.dueDate || null,
  });

  await runNotificationSafely(() =>
    notifyTaskAssigned(task)
  );

  await logActivitySafely({
    actor: req.user.id,
    action: "TASK_CREATED",
    entityType: "Task",
    entityId: task._id,
    description: `Created task: ${task.title}`,
    metadata: {
      assignedTo: task.assignedTo,
      priority: task.priority,
      status: task.status,
    },
    ipAddress: req.ip,
  });

  return res.status(201).json({
    success: true,
    data: task,
  });
}

export async function updateTask(req, res) {
  try {
    const task = await Task.findById(
      req.params.id
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const isAdmin =
      req.user.role === "admin";

    const isAssignedEmployee =
      String(task.assignedTo) ===
      String(req.user.id);

    if (!isAdmin && !isAssignedEmployee) {
      return res.status(403).json({
        success: false,
        message: "You cannot update this task",
      });
    }

    const old = {
      status: task.status,
      priority: task.priority,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString()
        : null,
    };

    if (req.body.status !== undefined) {
      const status = req.body.status;

      if (
        ![
          "Pending",
          "In Progress",
          "Completed",
        ].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid task status",
        });
      }

      if (
        status === "Completed" &&
        task.status !== "Completed"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Completion requires employee submission and admin approval",
        });
      }

      if (
        task.status === "Completed" &&
        status !== "Completed"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Completed tasks cannot be reopened here",
        });
      }

      if (
        task.reviewStatus === "Pending Review" &&
        status !== task.status
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot change status while review is pending",
        });
      }
    }

    const allowed = isAdmin
      ? [
          "title",
          "description",
          "priority",
          "status",
          "dueDate",
        ]
      : ["status"];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        task[key] = req.body[key];
      }
    }

    await task.save();

    await logActivitySafely({
      actor: req.user.id,
      action: "TASK_UPDATED",
      entityType: "Task",
      entityId: task._id,
      description: `Updated task: ${task.title}`,
      metadata: {
        previousStatus: old.status,
        newStatus: task.status,
        previousPriority: old.priority,
        newPriority: task.priority,
        previousTitle: old.title,
        newTitle: task.title,
        previousDescription: old.description,
        newDescription: task.description,
        previousDueDate: old.dueDate,
        newDueDate: task.dueDate
          ? new Date(task.dueDate).toISOString()
          : null,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("updateTask:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update task",
    });
  }
}
