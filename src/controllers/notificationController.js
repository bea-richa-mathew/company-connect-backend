
import Notification from "../models/Notification.js";

export async function getNotifications(req, res) {
  try {
    const userId = req.user.id;

    const [notifications, unreadCount] =
      await Promise.all([
        Notification.find({ recipient: userId })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
        Notification.countDocuments({
          recipient: userId,
          isRead: false
        })
      ]);

    res.json({
      success: true,
      data: notifications,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function markNotificationRead(req, res) {
  try {
    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          recipient: req.user.id
        },
        { isRead: true },
        { new: true }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    await Notification.updateMany(
      {
        recipient: req.user.id,
        isRead: false
      },
      { $set: { isRead: true } }
    );

    res.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
