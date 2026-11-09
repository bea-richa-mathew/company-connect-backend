
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["task", "project", "leave", "deadline", "system"],
      default: "system"
    },
    link: {
      type: String,
      default: ""
    },
    isRead: {
      type: Boolean,
      default: false
    },
    dedupeKey: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  { timestamps: true }
);

notificationSchema.index({
  recipient: 1,
  createdAt: -1
});

export default mongoose.model(
  "Notification",
  notificationSchema
);
