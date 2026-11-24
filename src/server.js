

import dns from "node:dns/promises";

import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// ==========================================
// DNS CONFIGURATION
// ==========================================

dns.setServers(["8.8.8.8", "8.8.4.4"]);

// ==========================================
// DATABASE
// ==========================================

import { connectDB } from "./config/db.js";

// ==========================================
// MIDDLEWARE
// ==========================================

import {
  notFound,
  errorHandler,
} from "./middleware/errorHandler.js";

import { protect } from "./middleware/auth.js";

// ==========================================
// EXISTING ROUTES
// ==========================================

import authRoutes from "./routes/authRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";

// ==========================================
// ADDITIONAL FEATURE ROUTES
// ==========================================

import performanceRoutes from "./routes/performanceRoutes.js";
import taskAttachmentRoutes from "./routes/taskAttachmentRoutes.js";
import taskSubmissionRoutes from "./routes/taskSubmissionRoutes.js";

// ==========================================
// LIVEKIT MEETING ROUTES
// ==========================================

import meetingRoutes from "./routes/meetingRoutes.js";

// ==========================================
// DEADLINE REMINDER SCHEDULER
// ==========================================

import {
  startDeadlineScheduler,
} from "./services/deadlineScheduler.js";

// ==========================================
// EXPRESS APPLICATION
// ==========================================

const app = express();

const PORT = Number(process.env.PORT || 5000);

// ==========================================
// PROXY CONFIGURATION
// RENDER / RAILWAY
// ==========================================

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ==========================================
// MORGAN HTTP REQUEST LOGGER
// ==========================================

// Development: Short and readable request logs
// Production: Detailed request logs

if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

app.use(helmet());

// ==========================================
// CORS CONFIGURATION
// LOCAL + NETLIFY + RAILWAY
// ==========================================

// Normalize URLs and remove trailing slashes
const normalizeOrigin = (origin) =>
  origin.trim().replace(/\/+$/, "");

// Parse comma-separated origins from environment
const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

// Allowed frontend and admin URLs
const allowedOrigins = new Set([
  // Local frontend
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  // Local admin
  "http://localhost:5174",
  "http://127.0.0.1:5174",

  // Netlify frontend
  "https://company-connect-frontend.netlify.app",

  // Netlify admin
  "https://company-connect-admin.netlify.app",

  // Environment variables
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.ADMIN_URL),

  // Railway frontend
  "https://company-connect-frontend-production.up.railway.app",

  // Railway admin
  "https://company-connect-admin-production.up.railway.app",
].map(normalizeOrigin));

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without Origin headers
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(
      `CORS rejected origin: ${normalizedOrigin}`
    );

    return callback(
      new Error("Not allowed by CORS")
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  optionsSuccessStatus: 204,
};

// Enable CORS for all routes
app.use(cors(corsOptions));

// ==========================================
// REQUEST BODY MIDDLEWARE
// ==========================================

app.use(
  express.json({
    limit: "5mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ==========================================
// COOKIE MIDDLEWARE
// ==========================================

app.use(cookieParser());

// ==========================================
// API RATE LIMITING
// ==========================================

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Company Portal API is running",
  });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.use("/api/auth", authRoutes);

// ==========================================
// EMPLOYEE ROUTES
// ==========================================

app.use("/api/employees", employeeRoutes);

// ==========================================
// JOB AND APPLICATION ROUTES
// ==========================================

app.use("/api/jobs", jobRoutes);

app.use("/api/applications", applicationRoutes);

// ==========================================
// LEAVE AND ATTENDANCE ROUTES
// ==========================================

app.use("/api/leaves", leaveRoutes);

app.use("/api/attendance", attendanceRoutes);

// ==========================================
// TASK ROUTES
// ==========================================

app.use("/api/tasks", taskRoutes);

// ==========================================
// ANNOUNCEMENT ROUTES
// ==========================================

app.use("/api/announcements", announcementRoutes);

// ==========================================
// ADMIN ROUTES
// ==========================================

app.use("/api/admin", adminRoutes);

// ==========================================
// CONTACT ROUTES
// ==========================================

app.use("/api/contact", contactRoutes);

// ==========================================
// PROJECT ROUTES
// ==========================================

app.use("/api/projects", projectRoutes);

// ==========================================
// NOTIFICATION ROUTES
// ==========================================

app.use("/api/notifications", notificationRoutes);

// ==========================================
// ACTIVITY LOG ROUTES
// ==========================================

app.use("/api/activity-logs", activityRoutes);

// ==========================================
// PERFORMANCE DASHBOARD
// ==========================================

app.use("/api/performance", performanceRoutes);

// ==========================================
// TASK ATTACHMENTS
// ==========================================

app.use("/api/tasks", taskAttachmentRoutes);

// ==========================================
// TASK SUBMISSIONS
// ==========================================

app.use("/api/tasks", taskSubmissionRoutes);

// ==========================================
// LIVEKIT GROUP MEETINGS
// ==========================================

app.use(
  "/api/meetings",
  protect,
  meetingRoutes
);

// ==========================================
// ERROR HANDLING
// ==========================================

app.use(notFound);

app.use(errorHandler);

// ==========================================
// START BACKEND SERVER
// ==========================================

async function startServer() {
  try {
    // Connect MongoDB
    await connectDB();

    // Start deadline reminder scheduler
    startDeadlineScheduler();

    // Start Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Backend running on port ${PORT}`
      );

      console.log(
        "Health check: /api/health"
      );

      console.log(
        "Allowed CORS origins:",
        [...allowedOrigins]
      );

      console.log(
        "Deadline reminder scheduler started"
      );

      console.log(
        "LiveKit meeting routes registered"
      );

      console.log(
        "Morgan HTTP request logger enabled"
      );
    });
  } catch (error) {
    console.error(
      "Backend startup failed:",
      error
    );

    process.exit(1);
  }
}

startServer();
