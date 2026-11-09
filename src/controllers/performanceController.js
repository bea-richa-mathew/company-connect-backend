
import mongoose from "mongoose";

import Task from "../models/Task.js";
import User from "../models/User.js";
import Project from "../models/Project.js";

function calculatePerformance(employee, tasks, projects) {
  const employeeId = String(employee._id);

  const employeeTasks = tasks.filter(
    (task) =>
      String(task.assignedTo) === employeeId
  );

  const employeeProjects = projects.filter(
    (project) =>
      (project.assignedEmployees || []).some(
        (member) =>
          String(member.employee?._id || member.employee) ===
          employeeId
      )
  );

  // TASK PERFORMANCE

  const totalTasks = employeeTasks.length;

  const completedTasks = employeeTasks.filter(
    (task) => task.status === "Completed"
  ).length;

  const inProgressTasks = employeeTasks.filter(
    (task) => task.status === "In Progress"
  ).length;

  const pendingTasks = employeeTasks.filter(
    (task) => task.status === "Pending"
  ).length;

  const now = new Date();

  const overdueTasks = employeeTasks.filter(
    (task) =>
      task.dueDate &&
      new Date(task.dueDate) < now &&
      task.status !== "Completed"
  ).length;

  const completionRate = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // PROJECT PERFORMANCE

  const totalProjects = employeeProjects.length;

  const completedProjects = employeeProjects.filter(
    (project) => project.status === "Completed"
  ).length;

  const approvedProjects = employeeProjects.filter(
    (project) =>
      project.status === "Completed" &&
      project.reviewStatus === "Approved"
  ).length;

  const inProgressProjects = employeeProjects.filter(
    (project) => project.status === "In Progress"
  ).length;

  const planningProjects = employeeProjects.filter(
    (project) => project.status === "Planning"
  ).length;

  const onHoldProjects = employeeProjects.filter(
    (project) => project.status === "On Hold"
  ).length;

  const pendingReviewProjects = employeeProjects.filter(
    (project) =>
      project.status === "Completed" &&
      project.reviewStatus === "Pending Review"
  ).length;

  const projectCompletionRate = totalProjects
    ? Math.round(
        (completedProjects / totalProjects) * 100
      )
    : 0;

  // COMBINED PERFORMANCE
  // Approved projects count as verified completions.
  // Each task and project has equal weight.

  const totalWork = totalTasks + totalProjects;

  const completedWork =
    completedTasks + approvedProjects;

  const overallPerformanceRate = totalWork
    ? Math.round(
        (completedWork / totalWork) * 100
      )
    : 0;

  return {
    employee: {
      _id: employee._id,
      name: employee.name,
      email: employee.email,
      employeeId: employee.employeeId,
      department: employee.department,
      designation: employee.designation
    },

    // Existing task fields
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    overdueTasks,
    completionRate,

    // New project fields
    totalProjects,
    completedProjects,
    approvedProjects,
    inProgressProjects,
    planningProjects,
    onHoldProjects,
    pendingReviewProjects,
    projectCompletionRate,

    // Combined fields
    totalWork,
    completedWork,
    overallPerformanceRate
  };
}

export async function getEmployeePerformance(req, res) {
  try {
    const { employeeId } = req.params;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID"
      });
    }

    const employee = await User.findOne({
      _id: employeeId,
      role: "employee"
    })
      .select(
        "name email employeeId department designation"
      )
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const [tasks, projects] = await Promise.all([
      Task.find({
        assignedTo: employeeId
      }).lean(),

      Project.find({
        "assignedEmployees.employee": employeeId
      })
        .select(
          "status reviewStatus assignedEmployees"
        )
        .lean()
    ]);

    const performance = calculatePerformance(
      employee,
      tasks,
      projects
    );

    return res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error(
      "Employee performance error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to calculate employee performance"
    });
  }
}

export async function getOverallPerformance(req, res) {
  try {
    const [employees, tasks, projects] =
      await Promise.all([
        User.find({
          role: "employee"
        })
          .select(
            "name email employeeId department designation"
          )
          .lean(),

        Task.find({})
          .select(
            "assignedTo status dueDate"
          )
          .lean(),

        Project.find({})
          .select(
            "status reviewStatus assignedEmployees"
          )
          .lean()
      ]);

    const performance = employees.map(
      (employee) =>
        calculatePerformance(
          employee,
          tasks,
          projects
        )
    );

    performance.sort(
      (a, b) =>
        b.overallPerformanceRate -
          a.overallPerformanceRate ||
        b.completedWork - a.completedWork ||
        a.employee.name.localeCompare(
          b.employee.name
        )
    );

    return res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error(
      "Overall performance error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load performance report"
    });
  }
}
