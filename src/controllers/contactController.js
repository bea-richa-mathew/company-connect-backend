
import ContactMessage from "../models/ContactMessage.js";

export async function createContactMessage(req, res) {
  const { name, email, message, subject } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "Name, email and message are required"
    });
  }

  const contact = await ContactMessage.create({
    name,
    email,
    subject: subject || "",
    message
  });

  res.status(201).json({
    success: true,
    message: "Your message has been submitted",
    data: { _id: contact._id }
  });
}

export async function listContactMessages(req, res) {
  const messages = await ContactMessage.find()
    .sort({ createdAt: -1 });

  res.json({ success: true, data: messages });
}

export async function updateContactMessage(req, res) {
  const { status } = req.body;

  if (!["New", "Read", "Resolved"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid contact status"
    });
  }

  const contact = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true, runValidators: true }
  );

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: "Contact message not found"
    });
  }

  res.json({ success: true, data: contact });
}