
import Application from "../models/Application.js";
import Job from "../models/Job.js";

export async function createApplication(req, res) {
  const { job, applicantName, email } = req.body;

  if (!job || !applicantName || !email) {
    return res.status(400).json({
      success: false,
      message: "Job, applicant name and email are required"
    });
  }

  const jobRecord = await Job.findById(job);

  if (!jobRecord || jobRecord.status !== "Open") {
    return res.status(400).json({
      success: false,
      message: "This job is not available"
    });
  }

  if (jobRecord.deadline && jobRecord.deadline < new Date()) {
    return res.status(400).json({
      success: false,
      message: "The application deadline has passed"
    });
  }

  const application = await Application.create({
    ...req.body,
    email: email.toLowerCase(),
    applicant: req.user?.id || null
  });

  res.status(201).json({ success: true, data: application });
}

export async function listApplications(req, res) {
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.job) filter.job = req.query.job;

  const applications = await Application.find(filter)
    .populate("job", "title department location")
    .populate("applicant", "name email employeeId")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: applications });
}

export async function getMyApplications(req, res) {
  const filter = req.user.role === "user"
    ? { $or: [{ applicant: req.user.id }, { email: req.user.email }] }
    : { applicant: req.user.id };

  const applications = await Application.find(filter)
    .populate("job", "title department location")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: applications });
}

export async function updateApplication(req, res) {
  const allowed = ["status", "notes"];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const application = await Application.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!application) {
    return res.status(404).json({
      success: false,
      message: "Application not found"
    });
  }

  res.json({ success: true, data: application });
}