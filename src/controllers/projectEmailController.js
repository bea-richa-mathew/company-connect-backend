
import mongoose from "mongoose";
import Project from "../models/Project.js";
import User from "../models/User.js";

export async function getProjectEmailContact(req, res) {
  try {
    if (req.projectUser?.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Employee access required.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      "assignedEmployees.employee": req.projectUser._id,
    }).select("createdBy title");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Assigned project not found.",
      });
    }

    if (!project.createdBy) {
      return res.json({
        success: true,
        data: null,
        message: "No project creator is recorded.",
      });
    }

    const admin = await User.findOne({
      _id: project.createdBy,
      role: "admin",
      isActive: true,
    })
      .select("name email")
      .lean();

    return res.json({
      success: true,
      data: admin
        ? {
            name: admin.name,
            email: admin.email,
          }
        : null,
    });
  } catch (error) {
    console.error("getProjectEmailContact:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load project email contact.",
    });
  }
}
