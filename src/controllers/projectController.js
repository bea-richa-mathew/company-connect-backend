
import mongoose from "mongoose";
import Project from "../models/Project.js";
import User from "../models/User.js";

import {
  createNotification,
  notifyProjectAssigned,
  notifyProjectCompleted,
  notifyProjectReviewed,
  runNotificationSafely
} from "../services/notificationService.js";

const validId = (id) => mongoose.isValidObjectId(id);

const statuses = [
  "Planning",
  "In Progress",
  "Completed",
  "On Hold"
];

const contentFields = [
  "title",
  "category",
  "description",
  "summary",
  "problem",
  "solution",
  "features",
  "technologies",
  "imageUrl",
  "projectUrl"
];

const textFields = contentFields.filter(
  (field) => !["features", "technologies"].includes(field)
);

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function getContent(body) {
  const result = {};

  for (const field of textFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "string") {
        throw new Error(`${field} must be text.`);
      }

      result[field] = body[field].trim();
    }
  }

  for (const field of ["features", "technologies"]) {
    if (body[field] !== undefined) {
      if (!Array.isArray(body[field])) {
        throw new Error(`${field} must be an array.`);
      }

      result[field] = body[field]
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  return result;
}

function snapshotOf(project) {
  const snapshot = {
    slug: project.slug,
    status: project.status
  };

  for (const field of contentFields) {
    snapshot[field] = project[field];
  }

  return JSON.parse(JSON.stringify(snapshot));
}

function publicVersion(project) {
  const source =
    project.publishedSnapshot || snapshotOf(project);

  return {
    _id: project._id,
    ...source,
    isPublished: true,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function preservePublishedVersion(project) {
  if (
    project.isPublished &&
    !project.publishedSnapshot
  ) {
    project.publishedSnapshot = snapshotOf(project);
    project.publishedSlug = project.slug;
  }
}

function resetReview(project) {
  project.reviewStatus = "Not Submitted";
  project.submittedAt = null;
  project.reviewedAt = null;
  project.reviewedBy = null;
  project.reviewComment = "";
}

function canEdit(project, userId) {
  return (project.assignedEmployees || []).some(
    (member) =>
      String(
        member.employee?._id || member.employee
      ) === String(userId) &&
      member.canEdit === true
  );
}

function isAssigned(project, userId) {
  return (project.assignedEmployees || []).some(
    (member) =>
      String(
        member.employee?._id || member.employee
      ) === String(userId)
  );
}

function sendError(res, error) {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message:
        "A project with this slug already exists."
    });
  }

  return res.status(400).json({
    success: false,
    message:
      error.message || "Invalid project data."
  });
}

function invalidProjectId(req, res) {
  if (validId(req.params.id)) return false;

  res.status(400).json({
    success: false,
    message: "Invalid project ID."
  });

  return true;
}

function employeeOnly(req, res) {
  if (
    req.projectUser?.role === "employee"
  ) {
    return false;
  }

  res.status(403).json({
    success: false,
    message: "Employee access required."
  });

  return true;
}

const populateEmployees = (query) =>
  query.populate(
    "assignedEmployees.employee",
    "name email employeeId department"
  );

// PUBLIC PROJECTS

export async function getPublicProjects(req, res) {
  try {
    const projects = await Project.find({
      isPublished: true
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: projects.map(publicVersion)
    });
  } catch {
    res.status(500).json({
      success: false,
      message:
        "Unable to load public projects."
    });
  }
}

export async function getPublicProject(req, res) {
  try {
    const projects = await Project.find({
      isPublished: true,
      $or: [
        {
          publishedSlug: req.params.slug
        },
        {
          publishedSlug: null,
          slug: req.params.slug
        }
      ]
    }).lean();

    const project = projects[0];

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    res.json({
      success: true,
      data: publicVersion(project)
    });
  } catch {
    res.status(500).json({
      success: false,
      message:
        "Unable to load public project."
    });
  }
}

// ADMIN PROJECTS

export async function getAdminProjects(req, res) {
  try {
    const projects = await populateEmployees(
      Project.find().sort({
        createdAt: -1
      })
    );

    res.json({
      success: true,
      data: projects
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to load projects."
    });
  }
}

export async function createProject(req, res) {
  try {
    const content = getContent(req.body);

    if (
      !content.title ||
      !content.category ||
      !content.description
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, category and description are required."
      });
    }

    const slug = slugify(
      req.body.slug || content.title
    );

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Invalid project slug."
      });
    }

    if (
      req.body.status !== undefined &&
      !statuses.includes(req.body.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project status."
      });
    }

    const project = await Project.create({
      ...content,
      slug,
      status:
        req.body.status || "Planning",
      reviewStatus: "Not Submitted",
      isPublished: false,
      createdBy: req.projectUser._id
    });

    res.status(201).json({
      success: true,
      message:
        "Project created successfully.",
      data: project
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updateAdminProject(req, res) {
  try {
    if (invalidProjectId(req, res)) return;

    const project = await Project.findById(
      req.params.id
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    preservePublishedVersion(project);

    const content = getContent(req.body);
    let changed = false;

    for (
      const [key, value] of Object.entries(content)
    ) {
      if (
        JSON.stringify(project[key]) !==
        JSON.stringify(value)
      ) {
        project[key] = value;
        changed = true;
      }
    }

    if (req.body.slug !== undefined) {
      const slug = slugify(req.body.slug);

      if (!slug) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid project slug."
        });
      }

      if (slug !== project.slug) {
        project.slug = slug;
        changed = true;
      }
    }

    if (req.body.status !== undefined) {
      if (
        !statuses.includes(req.body.status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid project status."
        });
      }

      if (
        project.status !== req.body.status
      ) {
        project.status = req.body.status;
        changed = true;
      }
    }

    if (changed) {
      resetReview(project);
    }

    if (req.body.isPublished === true) {
      if (
        project.status !== "Completed" ||
        project.reviewStatus !== "Approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Complete and approve the latest draft before publishing."
        });
      }

      project.publishedSnapshot =
        snapshotOf(project);

      project.publishedSlug =
        project.slug;

      project.isPublished = true;
    } else if (
      req.body.isPublished === false
    ) {
      project.isPublished = false;
    }

    await project.save();

    res.json({
      success: true,
      message:
        "Project updated successfully.",
      data: project
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function deleteProject(req, res) {
  try {
    if (invalidProjectId(req, res)) return;

    const project =
      await Project.findByIdAndDelete(
        req.params.id
      );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    res.json({
      success: true,
      message:
        "Project deleted successfully."
    });
  } catch {
    res.status(500).json({
      success: false,
      message:
        "Unable to delete project."
    });
  }
}

// PROJECT EMPLOYEE PERMISSIONS

export async function setProjectPermission(req, res) {
  try {
    const {
      employeeId,
      canEdit: permission
    } = req.body;

    if (invalidProjectId(req, res)) {
      return;
    }

    if (
      !validId(employeeId) ||
      typeof permission !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid employee and permission are required."
      });
    }

    const employee = await User.findOne({
      _id: employeeId,
      role: "employee",
      isActive: true
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Active employee not found."
      });
    }

    const project = await Project.findById(
      req.params.id
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    const member =
      project.assignedEmployees.find(
        (item) =>
          String(item.employee) ===
          String(employeeId)
      );

    const isNewAssignment = !member;

    const permissionChanged =
      member &&
      member.canEdit !== permission;

    if (member) {
      member.canEdit = permission;
    } else {
      project.assignedEmployees.push({
        employee: employeeId,
        canEdit: permission
      });
    }

    await project.save();

    // Notify the employee about a new assignment.
    if (isNewAssignment) {
      await runNotificationSafely(() =>
        notifyProjectAssigned({
          employeeId,
          actor: req.projectUser._id,
          projectTitle: project.title
        })
      );
    }

    // Notify the employee if editing permission changes.
    if (permissionChanged) {
      await runNotificationSafely(() =>
        createNotification({
          recipient: employeeId,
          actor: req.projectUser._id,
          title: "Project Permission Updated",
          message: permission
            ? `You can now edit the project: ${project.title}`
            : `Your editing permission was removed for: ${project.title}`,
          type: "project",
          link: "/employee/projects"
        })
      );
    }

    await project.populate(
      "assignedEmployees.employee",
      "name email employeeId department"
    );

    res.json({
      success: true,
      message:
        "Employee permission updated.",
      data: project
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function removeProjectEmployee(req, res) {
  try {
    const {
      id,
      employeeId
    } = req.params;

    if (
      !validId(id) ||
      !validId(employeeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID."
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found."
      });
    }

    const wasAssigned = isAssigned(
      project,
      employeeId
    );

    project.assignedEmployees =
      project.assignedEmployees.filter(
        (member) =>
          String(member.employee) !==
          String(employeeId)
      );

    await project.save();

    if (wasAssigned) {
      await runNotificationSafely(() =>
        createNotification({
          recipient: employeeId,
          actor: req.projectUser._id,
          title: "Project Assignment Removed",
          message:
            `You have been removed from the project: ${project.title}`,
          type: "project",
          link: "/employee/projects"
        })
      );
    }

    res.json({
      success: true,
      message:
        "Employee removed from project."
    });
  } catch {
    res.status(500).json({
      success: false,
      message:
        "Unable to remove employee."
    });
  }
}

// EMPLOYEE PROJECTS

export async function getEmployeeProjects(req, res) {
  try {
    if (employeeOnly(req, res)) return;

    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .lean();

    const data = projects.map((project) => {
      const {
        assignedEmployees,
        createdBy,
        publishedSnapshot,
        ...rest
      } = project;

      return {
        ...rest,
        reviewStatus:
          project.reviewStatus ||
          "Not Submitted",
        canEdit: canEdit(
          project,
          req.projectUser._id
        ),
        isAssigned: isAssigned(
          project,
          req.projectUser._id
        )
      };
    });

    res.json({
      success: true,
      data
    });
  } catch {
    res.status(500).json({
      success: false,
      message:
        "Unable to load employee projects."
    });
  }
}

// EMPLOYEE EDITING

export async function updateEmployeeProject(req, res) {
  try {
    if (employeeOnly(req, res)) return;
    if (invalidProjectId(req, res)) return;

    const content = getContent(req.body);

    if (
      !Object.keys(content).length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No editable fields provided."
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      reviewStatus: {
        $ne: "Pending Review"
      },
      assignedEmployees: {
        $elemMatch: {
          employee: req.projectUser._id,
          canEdit: true
        }
      }
    });

    if (!project) {
      return res.status(403).json({
        success: false,
        message:
          "Editing unavailable. Check permission or review status."
      });
    }

    preservePublishedVersion(project);

    Object.assign(project, content);

    project.status = "In Progress";

    resetReview(project);

    await project.save();

    res.json({
      success: true,
      message:
        "Project draft updated successfully.",
      data: project
    });
  } catch (error) {
    sendError(res, error);
  }
}

// EMPLOYEE STATUS UPDATE

export async function updateEmployeeProjectStatus(
  req,
  res
) {
  try {
    if (employeeOnly(req, res)) return;
    if (invalidProjectId(req, res)) return;

    const { status } = req.body;

    if (
      !["In Progress", "On Hold"].includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status."
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      reviewStatus: {
        $ne: "Pending Review"
      },
      assignedEmployees: {
        $elemMatch: {
          employee: req.projectUser._id,
          canEdit: true
        }
      }
    });

    if (!project) {
      return res.status(403).json({
        success: false,
        message:
          "Status update unavailable. Check permission or review status."
      });
    }

    preservePublishedVersion(project);

    project.status = status;

    resetReview(project);

    await project.save();

    res.json({
      success: true,
      message:
        `Project status updated to ${status}.`,
      data: project
    });
  } catch (error) {
    sendError(res, error);
  }
}

// EMPLOYEE PROJECT COMPLETION

export async function completeEmployeeProject(req, res) {
  try {
    if (employeeOnly(req, res)) return;
    if (invalidProjectId(req, res)) return;

    const project = await Project.findOne({
      _id: req.params.id,
      reviewStatus: {
        $ne: "Pending Review"
      },
      assignedEmployees: {
        $elemMatch: {
          employee: req.projectUser._id,
          canEdit: true
        }
      }
    });

    if (!project) {
      return res.status(403).json({
        success: false,
        message:
          "Completion unavailable. Check permission or review status."
      });
    }

    preservePublishedVersion(project);

    project.status = "Completed";
    project.reviewStatus = "Pending Review";
    project.submittedAt = new Date();
    project.reviewedAt = null;
    project.reviewedBy = null;
    project.reviewComment = "";

    await project.save();

    // Notify admins that the project needs review.
    await runNotificationSafely(() =>
      notifyProjectCompleted({
        actor: req.projectUser._id,
        projectTitle: project.title
      })
    );

    res.json({
      success: true,
      message:
        "Completion submitted for admin review.",
      data: project
    });
  } catch (error) {
    sendError(res, error);
  }
}

// ADMIN PROJECT REVIEW

export async function reviewProject(req, res) {
  try {
    if (invalidProjectId(req, res)) return;

    const {
      decision,
      comment = ""
    } = req.body;

    if (
      !["approve", "request_changes"].includes(
        decision
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid review decision."
      });
    }

    if (typeof comment !== "string") {
      return res.status(400).json({
        success: false,
        message:
          "Review comment must be text."
      });
    }

    if (
      decision === "request_changes" &&
      !comment.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide feedback."
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      status: "Completed",
      reviewStatus: "Pending Review"
    });

    if (!project) {
      return res.status(409).json({
        success: false,
        message:
          "Project is not pending review."
      });
    }

    preservePublishedVersion(project);

    const approved =
      decision === "approve";

    project.reviewStatus = approved
      ? "Approved"
      : "Changes Requested";

    project.status = approved
      ? "Completed"
      : "In Progress";

    project.reviewedAt = new Date();
    project.reviewedBy = req.projectUser._id;
    project.reviewComment = comment.trim();

    await project.save();

    // Notify all employees assigned to this project.
    const employeeIds = [
      ...new Set(
        (project.assignedEmployees || [])
          .map((member) =>
            String(
              member.employee?._id ||
              member.employee
            )
          )
          .filter((id) => validId(id))
      )
    ];

    await runNotificationSafely(() =>
      Promise.all(
        employeeIds.map((employeeId) =>
          notifyProjectReviewed({
            employeeId,
            actor: req.projectUser._id,
            projectTitle: project.title,
            approved
          })
        )
      )
    );

    res.json({
      success: true,
      message: approved
        ? "Project approved. Ready to publish."
        : "Changes requested from employee.",
      data: project
    });
  } catch (error) {
    sendError(res, error);
  }
}
