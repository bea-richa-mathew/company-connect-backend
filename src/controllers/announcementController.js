
import Announcement from "../models/Announcement.js";

export async function listAnnouncements(req, res) {
  const filter = req.user?.role === "admin"
    ? {}
    : { published: true };

  const announcements = await Announcement.find(filter)
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: announcements });
}

export async function createAnnouncement(req, res) {
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      message: "Title and message are required"
    });
  }

  const announcement = await Announcement.create({
    ...req.body,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: announcement
  });
}

export async function updateAnnouncement(req, res) {
  const allowed = ["title", "message", "category", "published"];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const announcement = await Announcement.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: "Announcement not found"
    });
  }

  res.json({ success: true, data: announcement });
}

export async function deleteAnnouncement(req, res) {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: "Announcement not found"
    });
  }

  res.json({ success: true, message: "Announcement deleted" });
}