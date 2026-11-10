
import Notification from "../models/Notification.js";
import User from "../models/User.js";

export async function createNotification({
  recipient,
  actor = null,
  title,
  message,
  type = "system",
  link = "",
  dedupeKey
}) {
  if (!recipient) return null;

  const data = {
    recipient,
    actor,
    title,
    message,
    type,
    link
  };

  if (dedupeKey) {
    return Notification.findOneAndUpdate(
      { dedupeKey },
      { $setOnInsert: { ...data, dedupeKey } },
      { upsert: true, new: true }
    );
  }

  return Notification.create(data);
}

export async function notifyAdmins(data) {
  const admins = await User.find({
    role: "admin",
    isActive: true
  }).select("_id");

  return Promise.all(
    admins.map((admin) =>
      createNotification({
        ...data,
        recipient: admin._id
      })
    )
  );
}

export async function runNotificationSafely(callback) {
  try {
    await callback();
  } catch (error) {
    console.error(
      "Notification error:",
      error.message
    );
  }
}

export async function notifyTaskAssigned(task) {
  return createNotification({
    recipient: task.assignedTo,
    actor: task.assignedBy,
    title: "New Task Assigned",
    message: `You have been assigned: ${task.title}`,
    type: "task",
    link: "/employee/tasks"
  });
}

export async function notifyTaskCompleted(task, actor) {
  return notifyAdmins({
    actor,
    title: "Task Completed",
    message: `Task completed: ${task.title}`,
    type: "task",
    link: "/admin/tasks"
  });
}

export async function notifyProjectAssigned({
  employeeId,
  actor,
  projectTitle
}) {
  return createNotification({
    recipient: employeeId,
    actor,
    title: "Project Assigned",
    message: `You have been assigned to ${projectTitle}`,
    type: "project",
    link: "/employee/projects"
  });
}

export async function notifyProjectCompleted({
  actor,
  projectTitle
}) {
  return notifyAdmins({
    actor,
    title: "Project Submitted",
    message: `${projectTitle} is ready for review.`,
    type: "project",
    link: "/admin/projects"
  });
}

export async function notifyProjectReviewed({
  employeeId,
  actor,
  projectTitle,
  approved
}) {
  return createNotification({
    recipient: employeeId,
    actor,
    title: approved
      ? "Project Approved"
      : "Project Changes Requested",
    message: approved
      ? `${projectTitle} has been approved.`
      : `Changes were requested for ${projectTitle}.`,
    type: "project",
    link: "/employee/projects"
  });
}
