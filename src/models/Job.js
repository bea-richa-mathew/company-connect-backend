
import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Full-time", "Part-time", "Internship", "Contract"],
      default: "Full-time"
    },
    experience: { type: String, default: "Entry level" },
    description: { type: String, required: true },
    skills: [{ type: String, trim: true }],
    deadline: { type: Date, default: null },
    status: {
      type: String,
      enum: ["Open", "Closed"],
      default: "Open"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);