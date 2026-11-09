
import Job from "../models/Job.js";

export async function listJobs(req, res) {
  // Automatically mark expired open jobs as closed.
  const now = new Date();

  await Job.updateMany(
    {
      status: "Open",
      deadline: {
        $ne: null,
        $lt: now,
      },
    },
    {
      $set: { status: "Closed" },
    }
  );

  // Public website: return only available jobs.
  // Admin panel: ?all=true returns every job.
  const filter = {};

  if (req.query.all !== "true") {
    filter.status = "Open";
    filter.$and = [
      {
        $or: [
          { deadline: null },
          { deadline: { $gte: now } },
        ],
      },
    ];
  }

  if (req.query.department) {
    filter.department = req.query.department;
  }

  if (req.query.type) {
    filter.type = req.query.type;
  }

  const jobs = await Job.find(filter).sort({
    createdAt: -1,
  });

  res.json({
    success: true,
    data: jobs,
  });
}

export async function getJob(req, res) {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  res.json({ success: true, data: job });
}

export async function createJob(req, res) {
  const { title, department, location, description } = req.body;

  if (!title || !department || !location || !description) {
    return res.status(400).json({
      success: false,
      message: "Title, department, location and description are required"
    });
  }

  const job = await Job.create({
    ...req.body,
    createdBy: req.user.id
  });

  res.status(201).json({ success: true, data: job });
}

export async function updateJob(req, res) {
  const allowed = [
    "title", "department", "location", "type", "experience",
    "description", "skills", "deadline", "status"
  ];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const job = await Job.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  res.json({ success: true, data: job });
}

export async function deleteJob(req, res) {
  const job = await Job.findByIdAndDelete(req.params.id);

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  res.json({ success: true, message: "Job deleted" });
}