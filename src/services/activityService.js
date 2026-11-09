
import ActivityLog from "../models/ActivityLog.js";

export async function logActivity({
  actor = null,
  action,
  entityType = "System",
  entityId = "",
  description = "",
  metadata = {},
  ipAddress = ""
}) {
  return ActivityLog.create({
    actor,
    action,
    entityType,
    entityId: String(entityId || ""),
    description,
    metadata,
    ipAddress
  });
}

export async function logActivitySafely(data) {
  try {
    return await logActivity(data);
  } catch (error) {
    console.error(
      "Activity log error:",
      error.message
    );
    return null;
  }
}
