
import Task from "../models/Task.js";

import {
  createNotification
} from "./notificationService.js";

export async function checkTaskDeadlines() {
  const now = new Date();

  const next24Hours = new Date(
    now.getTime() + 24 * 60 * 60 * 1000
  );

  const tasks = await Task.find({
    dueDate: { $lte: next24Hours },
    status: { $ne: "Completed" },
    assignedTo: { $exists: true, $ne: null }
  }).select(
    "title dueDate assignedTo status"
  );

  let remindersCreated = 0;

  for (const task of tasks) {
    try {
      const overdue = new Date(task.dueDate) < now;

      const reminderType = overdue
        ? "overdue"
        : "upcoming";

      const dateKey = now.toISOString().slice(0, 10);

      const dedupeKey = [
        "task-deadline",
        String(task._id),
        reminderType,
        dateKey
      ].join(":");

      await createNotification({
        recipient: task.assignedTo,
        actor: null,
        title: overdue
          ? "Task overdue"
          : "Task deadline approaching",
        message: overdue
          ? `Your task "${task.title}" is overdue.`
          : `Your task "${task.title}" is due within 24 hours.`,
        type: "deadline",
        link: "/employee/tasks",
        dedupeKey
      });

      remindersCreated++;
    } catch (error) {
      console.error(
        `Deadline reminder failed for task ${task._id}:`,
        error.message
      );
    }
  }

  return {
    checked: tasks.length,
    remindersCreated
  };
}
