
import { Router } from "express";
import {
  createContactMessage,
  listContactMessages,
  updateContactMessage
} from "../controllers/contactController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/", createContactMessage);
router.get("/", protect, authorize("admin"), listContactMessages);
router.patch("/:id", protect, authorize("admin"), updateContactMessage);

export default router;