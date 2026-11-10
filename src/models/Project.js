import mongoose from "mongoose";

const projectMemberSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    canEdit: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    summary: { type: String, default: "" },
    problem: { type: String, default: "" },
    solution: { type: String, default: "" },
    features: { type: [String], default: [] },
    technologies: { type: [String], default: [] },
    imageUrl: { type: String, default: "" },
    projectUrl: { type: String, default: "" },

    status: {
      type: String,
      enum: ["Planning", "In Progress", "Completed", "On Hold"],
      default: "Planning"
    },

    reviewStatus: {
      type: String,
      enum: [
        "Not Submitted",
        "Pending Review",
        "Approved",
        "Changes Requested"
      ],
      default: "Not Submitted"
    },

    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewComment: { type: String, default: "" },

    isPublished: { type: Boolean, default: false },

    // The public website reads this approved version.
    publishedSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    // Public URL stays stable while a new slug is drafted.
    publishedSlug: {
      type: String,
      default: null
    },

    assignedEmployees: {
      type: [projectMemberSchema],
      default: []
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

projectSchema.index({ isPublished: 1, createdAt: -1 });
projectSchema.index({ reviewStatus: 1, updatedAt: -1 });
projectSchema.index({ publishedSlug: 1 });

export default mongoose.model("Project", projectSchema);