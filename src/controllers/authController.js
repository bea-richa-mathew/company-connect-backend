import User from "../models/User.js";

import {
  createToken,
  publicUser,
} from "../utils/auth.js";

import {
  logActivitySafely,
} from "../services/activityService.js";

// ==========================================
// PASSWORD VALIDATION
// ==========================================

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8
  ) {
    return "Password must contain at least 8 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }

  return null;
}

// ==========================================
// REGISTER USER OR EMPLOYEE
// ==========================================

export async function register(req, res) {
  try {
    const {
      name,
      email,
      password,
      role = "user",
      department,
      designation,
      phone,
    } = req.body || {};

    // Validate required fields
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required.",
      });
    }

    // Public registration cannot create admins
    if (!["user", "employee"].includes(role)) {
      return res.status(400).json({
        success: false,
        message:
          "Role must be user or employee.",
      });
    }

    // Password validation
    const passwordError =
      validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    // Employee-specific validation
    if (role === "employee") {
      if (
        typeof department !== "string" ||
        !department.trim() ||
        typeof designation !== "string" ||
        !designation.trim() ||
        typeof phone !== "string" ||
        !phone.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Department, designation and phone number are required for employees.",
        });
      }
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // Check existing account
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "Email is already registered.",
      });
    }

    // Prepare user data
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
    };

    // Employee-specific information
    if (role === "employee") {
      userData.department = department.trim();
      userData.designation = designation.trim();
      userData.phone = phone.trim();
    }

    // User model should hash password
    const user = await User.create(userData);

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully.",
      user: publicUser(user),
      token,
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Email or employee ID already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to register account.",
    });
  }
}

// ==========================================
// CREATE ADMIN
// ==========================================

export async function createAdmin(req, res) {
  try {
    const setupKey =
      req.headers["x-admin-setup-key"];

    if (
      !process.env.ADMIN_SETUP_KEY ||
      setupKey !== process.env.ADMIN_SETUP_KEY
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Valid admin setup key required.",
      });
    }

    const {
      name,
      email,
      password,
    } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required.",
      });
    }

    const passwordError =
      validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "Email is already registered.",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: "admin",
    });

    return res.status(201).json({
      success: true,
      message:
        "Admin created successfully.",
      user: publicUser(user),
      token: createToken(user),
    });
  } catch (error) {
    console.error(
      "Create admin error:",
      error
    );

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Email is already registered.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to create admin account.",
    });
  }
}

// ==========================================
// LOGIN USER / EMPLOYEE / ADMIN
// ==========================================

export async function login(req, res) {
  try {
    const {
      email,
      password,
    } = req.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // Password is select:false in User model
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (
      !user ||
      !(await user.comparePassword(password))
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive.",
      });
    }

    const token = createToken(user);

    // Log successful login without interrupting
    // authentication if activity logging fails.
    try {
      await logActivitySafely({
        actor: user._id,
        action: "LOGIN",
        entityType: "User",
        entityId: user._id,
        description:
          `${user.name} logged in`,
        metadata: {
          role: user.role,
        },
        ipAddress: req.ip,
      });
    } catch (activityError) {
      console.error(
        "Login activity logging error:",
        activityError
      );
    }

    // ADMIN AUTHENTICATION
    // Admin uses HttpOnly cookie.
    if (user.role === "admin") {
      res.cookie(
        "company_portal_admin_session",
        token,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV ===
            "production",
          sameSite: "lax",
          maxAge:
            24 * 60 * 60 * 1000,
          path: "/",
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Login successful.",
        user: publicUser(user),
      });
    }

    // USER / EMPLOYEE AUTHENTICATION
    // Return Bearer token.
    return res.status(200).json({
      success: true,
      message:
        "Login successful.",
      user: publicUser(user),
      token,
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to complete login.",
    });
  }
}

// ==========================================
// GET CURRENT USER
// ==========================================

export async function getMe(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const user = await User.findById(
      req.user.id
    );

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message:
          "User not found or account inactive.",
      });
    }

    return res.status(200).json({
      success: true,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load user profile.",
    });
  }
}