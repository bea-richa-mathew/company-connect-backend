import { Router } from "express";
import {
  register,
  createAdmin,
  login,
  getMe,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/create-admin", createAdmin);
router.post("/login", login);

router.post("/logout", (req, res) => {
  res.clearCookie("company_portal_admin_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
});

router.get("/me", protect, getMe);

export default router;