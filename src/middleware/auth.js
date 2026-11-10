import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;

    const bearerToken = header?.startsWith("Bearer ")
      ? header.split(" ")[1]
      : null;

    const token =
      bearerToken ||
      req.cookies?.company_portal_admin_session;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured",
      });
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or account is inactive",
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };
}