import mongoose from "mongoose";

const taskSubmissionSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    file: {
      originalName: String,
      storedName: String,
      mimeType: String,
      size: Number,
    },
    status: {
      type: String,
      enum: [
        "Pending Review",
        "Approved",
        "Changes Requested",
      ],
      default: "Pending Review",
    },
    reviewComment: {
      type: String,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

taskSubmissionSchema.index({
  task: 1,
  createdAt: -1,
});

export default mongoose.model(
  "TaskSubmission",
  taskSubmissionSchema
);