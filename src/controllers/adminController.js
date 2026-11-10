
import User from "../models/User.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Attendance from "../models/Attendance.js";
import Task from "../models/Task.js";
import ContactMessage from "../models/ContactMessage.js";

export async function dashboard(req, res) {
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  const [
    totalEmployees,
    activeEmployees,
    totalJobs,
    openJobs,
    totalApplications,
    pendingLeaves,
    todayAttendance,
    pendingTasks,
    newMessages
  ] = await Promise.all([
    User.countDocuments({ role: "employee" }),
    User.countDocuments({ role: "employee", isActive: true }),
    Job.countDocuments(),
    Job.countDocuments({ status: "Open" }),
    Application.countDocuments(),
    LeaveRequest.countDocuments({ status: "Pending" }),
    Attendance.countDocuments({ date, status: "Present" }),
    Task.countDocuments({ status: { $ne: "Completed" } }),
    ContactMessage.countDocuments({ status: "New" })
  ]);

  res.json({
    success: true,
    data: {
      totalEmployees,
      activeEmployees,
      totalJobs,
      openJobs,
      totalApplications,
      pendingLeaves,
      todayAttendance,
      pendingTasks,
      newMessages
    }
  });
}

export async function statistics(req, res) {
  const [
    applicationsByStatus,
    employeesByDepartment,
    attendanceByStatus,
    leavesByStatus
  ] = await Promise.all([
    Application.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    User.aggregate([
      { $match: { role: "employee" } },
      { $group: { _id: "$department", count: { $sum: 1 } } }
    ]),
    Attendance.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    LeaveRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      applicationsByStatus,
      employeesByDepartment,
      attendanceByStatus,
      leavesByStatus
    }
  });
}