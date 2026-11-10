
import User from "../models/User.js";
import { publicUser } from "../utils/auth.js";

export async function listEmployees(req, res) {
  const { search, department, page = 1, limit = 20 } = req.query;
  const filter = { role: "employee" };

  if (department) filter.department = department;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } }
    ];
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

  const [employees, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    User.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: employees.map(publicUser),
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      pages: Math.ceil(total / pageSize)
    }
  });
}

export async function getEmployee(req, res) {
  const employee = await User.findOne({
    _id: req.params.id,
    role: "employee"
  });

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found"
    });
  }

  res.json({ success: true, data: publicUser(employee) });
}

export async function createEmployee(req, res) {
  const { name, email, password, department, designation, phone, address, joiningDate } = req.body;

  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Name, email and a password of at least 8 characters are required"
    });
  }

  const exists = await User.findOne({ email: email.toLowerCase() });

  if (exists) {
    return res.status(409).json({
      success: false,
      message: "Email is already registered"
    });
  }

  const employee = await User.create({
    name,
    email,
    password,
    role: "employee",
    department,
    designation,
    phone,
    address,
    joiningDate
  });

  res.status(201).json({
    success: true,
    message: "Employee created successfully",
    data: publicUser(employee)
  });
}

export async function updateEmployee(req, res) {
  const allowed = [
    "name", "department", "designation", "phone",
    "address", "joiningDate", "profileImage", "isActive"
  ];

  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const employee = await User.findOneAndUpdate(
    { _id: req.params.id, role: "employee" },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found"
    });
  }

  res.json({
    success: true,
    message: "Employee updated",
    data: publicUser(employee)
  });
}

export async function getMyEmployeeProfile(req, res) {
  const employee = await User.findById(req.user.id);

  res.json({ success: true, data: publicUser(employee) });
}

export async function updateMyProfile(req, res) {
  const allowed = ["name", "phone", "address", "profileImage"];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const employee = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.json({ success: true, data: publicUser(employee) });
}