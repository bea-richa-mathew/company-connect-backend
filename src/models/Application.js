
import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    applicantName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    resumeUrl: { type: String, default: "" },
    coverLetter: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Applied", "Shortlisted", "Interview", "Selected", "Rejected"],
      default: "Applied"
    },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

applicationSchema.index({ job: 1, email: 1 }, { unique: true });

export default mongoose.model("Application", applicationSchema);