
import dns from "node:dns/promises";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// Database
import { connectDB } from "./config/db.js";

// Middleware
import {
  notFound,
  errorHandler,
} from "./middleware/errorHandler.js";

import { protect } from "./middleware/auth.js";

// Existing Routes
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

// Additional Feature Routes
import performanceRoutes from "./routes/performanceRoutes.js";
import taskAttachmentRoutes from "./routes/taskAttachmentRoutes.js";
import taskSubmissionRoutes from "./routes/taskSubmissionRoutes.js";

// LiveKit Meeting Routes
import meetingRoutes from "./routes/meetingRoutes.js";

// Deadline Reminder Scheduler
import {
  startDeadlineScheduler,
} from "./services/deadlineScheduler.js";

const app = express();

const PORT = Number(process.env.PORT || 5000);

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

app.use(helmet());

// ==========================================
// CORS CONFIGURATION - LOCAL + RAILWAY
// ==========================================

// Convert environment variables into URL lists.
// Supports comma-separated values.
const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const allowedOrigins = new Set([
  // Local development
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",

  // Railway employee/public frontend
  "https://company-connect-frontend-production.up.railway.app",

  // Railway admin panel
  "https://company-connect-admin-production.up.railway.app",

  // Additional configured frontend URLs
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.ADMIN_URL),
]);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header,
    // such as server-to-server requests.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, "");

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

// Apply CORS before API routes and authentication.
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
// EXISTING API ROUTES
// ==========================================

app.use("/api/auth", authRoutes);

app.use("/api/employees", employeeRoutes);

app.use("/api/jobs", jobRoutes);

app.use("/api/applications", applicationRoutes);

app.use("/api/leaves", leaveRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/announcements", announcementRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/contact", contactRoutes);

app.use("/api/projects", projectRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/activity-logs", activityRoutes);

// ==========================================
// PERFORMANCE DASHBOARD
// ==========================================

app.use("/api/performance", performanceRoutes);

// ==========================================
// TASK ATTACHMENTS AND SUBMISSIONS
// ==========================================

app.use("/api/tasks", taskAttachmentRoutes);

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

    // Start automatic deadline reminders
    startDeadlineScheduler();

    // Start Express server
    app.listen(PORT, () => {
      console.log(
        `Health check: /api/health`
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
