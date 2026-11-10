
import mongoose from "mongoose";
import LeaveRequest from "../models/LeaveRequest.js";
import User from "../models/User.js";

// GET /leaves
export async function listLeaves(req, res) {
  const filter =
    req.user.role === "admin"
      ? {}
      : { employee: req.user.id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const leaves = await LeaveRequest.find(filter)
    .populate(
      "employee",
      "name email employeeId department"
    )
    .populate("reviewedBy", "name")
    .sort({ createdAt: -1 });

  // Find an active admin to receive manually sent leave emails.
  // If more than one admin exists, select consistently by creation date.
  const admin = await User.findOne({
    role: "admin",
    isActive: true,
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("name email")
    .lean();

  return res.json({
    success: true,
    data: leaves,
    adminContact: admin
      ? {
          name: admin.name,
          email: admin.email,
        }
      : null,
  });
}

// POST /leaves
export async function createLeave(req, res) {
  const {
    leaveType,
    startDate,
    endDate,
    reason,
  } = req.body;

  if (
    !leaveType ||
    !startDate ||
    !endDate ||
    !reason?.trim()
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Leave type, dates and reason are required.",
    });
  }

  if (
    !["Annual", "Sick", "Casual"].includes(
      leaveType
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid leave type.",
    });
  }

  const isValidDateOnly = (value) => {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const date = new Date(
      `${value}T00:00:00.000Z`
    );

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) ===
        value
    );
  };

  if (
    !isValidDateOnly(startDate) ||
    !isValidDateOnly(endDate)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Please provide valid leave dates.",
    });
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (
    startDate < today ||
    endDate < today
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Past dates are not allowed for leave requests.",
    });
  }

  if (endDate < startDate) {
    return res.status(400).json({
      success: false,
      message:
        "The end date cannot be before the start date.",
    });
  }

  const leave = await LeaveRequest.create({
    employee: req.user.id,
    leaveType,
    startDate: new Date(
      `${startDate}T00:00:00.000Z`
    ),
    endDate: new Date(
      `${endDate}T00:00:00.000Z`
    ),
    reason: reason.trim(),
  });

  const populatedLeave =
    await LeaveRequest.findById(
      leave._id
    ).populate(
      "employee",
      "name email employeeId department"
    );

  return res.status(201).json({
    success: true,
    message:
      "Leave request submitted successfully.",
    data: populatedLeave,
  });
}

// PATCH /leaves/:id/review
export async function reviewLeave(req, res) {
  const { status, adminComment } =
    req.body;

  if (
    !["Approved", "Rejected"].includes(
      status
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Status must be Approved or Rejected.",
    });
  }

  if (
    !mongoose.isValidObjectId(
      req.params.id
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid leave request ID.",
    });
  }

  const leave =
    await LeaveRequest.findById(
      req.params.id
    );

  if (!leave) {
    return res.status(404).json({
      success: false,
      message:
        "Leave request not found.",
    });
  }

  if (leave.status !== "Pending") {
    return res.status(400).json({
      success: false,
      message:
        "This leave request has already been reviewed.",
    });
  }

  leave.status = status;
  leave.adminComment =
    typeof adminComment === "string"
      ? adminComment.trim()
      : "";

  leave.reviewedBy = req.user.id;
  leave.reviewedAt = new Date();

  await leave.save();

  await leave.populate([
    {
      path: "employee",
      select:
        "name email employeeId department",
    },
    {
      path: "reviewedBy",
      select: "name",
    },
  ]);

  return res.json({
    success: true,
    message:
      `Leave request ${status.toLowerCase()} successfully.`,
    data: leave,
  });
}
