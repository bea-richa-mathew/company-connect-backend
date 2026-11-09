import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    roomName: {
      type: String,
      required: true,
      unique: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    type: {
      type: String,
      enum: ["audio", "video"],
      default: "video",
    },

    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

meetingSchema.index({
  participants: 1,
  createdAt: -1,
});

export default mongoose.model("Meeting", meetingSchema);