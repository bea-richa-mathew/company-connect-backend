
import jwt from "jsonwebtoken";

export function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

export function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    department: user.department,
    designation: user.designation,
    phone: user.phone,
    address: user.address,
    joiningDate: user.joiningDate,
    profileImage: user.profileImage,
    isActive: user.isActive
  };
}