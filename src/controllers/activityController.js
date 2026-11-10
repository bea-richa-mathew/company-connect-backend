
import ActivityLog from "../models/ActivityLog.js";

export async function getActivityLogs(req, res) {
  try {
    const page = Math.max(
      1,
      Number(req.query.page) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 25)
    );

    const filter = {};

    if (req.query.action) {
      filter.action = req.query.action;
    }

    if (req.query.actor) {
      filter.actor = req.query.actor;
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate(
          "actor",
          "name email role employeeId"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      ActivityLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
