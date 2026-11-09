import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  AccessToken,
  RoomServiceClient,
} from "livekit-server-sdk";

import Meeting from "../models/Meeting.js";
import User from "../models/User.js";

function isValidId(value) {
  return (
    typeof value === "string" &&
    mongoose.isValidObjectId(value)
  );
}

function livekitConfig() {
  const {
    LIVEKIT_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
  } = process.env;

  if (
    !LIVEKIT_URL ||
    !LIVEKIT_API_KEY ||
    !LIVEKIT_API_SECRET
  ) {
    throw new Error(
      "LiveKit environment variables are missing"
    );
  }

  return {
    url: LIVEKIT_URL,
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET,
  };
}

function roomClient() {
  const config = livekitConfig();

  return new RoomServiceClient(
    config.url.replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:"),
    config.apiKey,
    config.apiSecret
  );
}

function isMember(meeting, userId) {
  return meeting.participants.some(
    (id) => String(id) === String(userId)
  );
}

function meetingData(meeting) {
  return {
    _id: String(meeting._id),
    title: meeting.title,
    roomName: meeting.roomName,
    type: meeting.type,
    status: meeting.status,
    createdBy: String(meeting.createdBy),
    participants: meeting.participants.map(String),
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    createdAt: meeting.createdAt,
  };
}

export async function createMeeting(req, res) {
  try {
    if (!["employee", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Meeting access denied",
      });
    }

    const title = String(
      req.body?.title || "Team Meeting"
    ).trim();

    const type = req.body?.type || "video";
    const supplied = req.body?.participants;

    if (
      !title ||
      title.length > 150 ||
      !["audio", "video"].includes(type) ||
      !Array.isArray(supplied) ||
      supplied.length > 49 ||
      supplied.some((id) => !isValidId(id))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting information",
      });
    }

    const participantIds = [
      ...new Set([
        req.user.id,
        ...supplied.map(String),
      ]),
    ];

    const users = await User.find({
      _id: { $in: participantIds },
      role: { $in: ["employee", "admin"] },
      isActive: true,
    }).select("_id");

    if (users.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more participants are unavailable",
      });
    }

    const meeting = await Meeting.create({
      title,
      roomName: `company-${randomUUID()}`,
      createdBy: req.user.id,
      participants: participantIds,
      type,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      data: meetingData(meeting),
    });
  } catch (error) {
    console.error("createMeeting:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create meeting",
    });
  }
}

export async function listMeetings(req, res) {
  try {
    const meetings = await Meeting.find({
      participants: req.user.id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      data: meetings.map(meetingData),
    });
  } catch (error) {
    console.error("listMeetings:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load meetings",
    });
  }
}

export async function getMeeting(req, res) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting ID",
      });
    }

    const meeting = await Meeting.findOne({
      _id: req.params.id,
      participants: req.user.id,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    return res.json({
      success: true,
      data: meetingData(meeting),
    });
  } catch (error) {
    console.error("getMeeting:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load meeting",
    });
  }
}

export async function getMeetingToken(req, res) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting ID",
      });
    }

    const meeting = await Meeting.findById(
      req.params.id
    );

    if (
      !meeting ||
      meeting.status !== "active" ||
      !isMember(meeting, req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Meeting access unavailable",
      });
    }

    const config = livekitConfig();

    const token = new AccessToken(
      config.apiKey,
      config.apiSecret,
      {
        identity: req.user.id,
        name: req.user.name || req.user.email,
        ttl: "2h",
      }
    );

    token.addGrant({
      roomJoin: true,
      room: meeting.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return res.json({
      success: true,
      data: {
        token: await token.toJwt(),
        serverUrl: config.url,
        meeting: meetingData(meeting),
      },
    });
  } catch (error) {
    console.error("getMeetingToken:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to generate meeting token",
    });
  }
}

export async function endMeeting(req, res) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting ID",
      });
    }

    const meeting = await Meeting.findById(
      req.params.id
    );

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    if (
      String(meeting.createdBy) !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the organizer or admin can end this meeting",
      });
    }

    if (meeting.status === "ended") {
      return res.json({
        success: true,
        data: meetingData(meeting),
      });
    }

    // Delete the LiveKit room first to disconnect
    // participants and revoke active room access.
    try {
      await roomClient().deleteRoom(meeting.roomName);
    } catch (error) {
      // LiveKit may not have created the room yet.
      // Other failures should not be silently ignored.
      if (
        error?.status !== 404 &&
        error?.statusCode !== 404
      ) {
        throw error;
      }
    }

    meeting.status = "ended";
    meeting.endedAt = new Date();
    await meeting.save();

    return res.json({
      success: true,
      data: meetingData(meeting),
    });
  } catch (error) {
    console.error("endMeeting:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to end meeting",
    });
  }
}