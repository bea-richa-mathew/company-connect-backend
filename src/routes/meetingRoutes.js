import { Router } from "express";

import {
  createMeeting,
  listMeetings,
  getMeeting,
  getMeetingToken,
  endMeeting,
} from "../controllers/meetingController.js";

const router = Router();

router.post("/", createMeeting);

router.get("/", listMeetings);

router.get("/:id", getMeeting);

router.post("/:id/token", getMeetingToken);

router.patch("/:id/end", endMeeting);

export default router;