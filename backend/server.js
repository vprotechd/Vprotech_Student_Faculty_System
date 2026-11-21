import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { registerChatSockets } from "./socket/chatSocket.js";

import env from "./config/env.js";
import connectDB from "./config/db.js";
import { verifyEmailTransport } from "./services/emailService.js";

import {
  notFound,
  errorHandler,
} from "./middleware/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import facultyRoutes from "./routes/facultyRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import doubtRoutes from "./routes/doubtRoutes.js";
import lectureRoutes from "./routes/lectureRoutes.js";
import materialRoutes from "./routes/materialRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import departmentRoutes from "./routes/departmentsRoutes.js";
import courseRoutes from "./routes/coursesRoutes.js";
import subjectRoutes from "./routes/subjectsRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import examRoutes from "./routes/examination/examRoutes.js";
import questionRoutes from "./routes/examination/questionRoutes.js";
import examAttemptRoutes from "./routes/examination/examAttemptRoutes.js";
import evaluationRoutes from "./routes/examination/evaluationRoutes.js";

import classroomRoutes, {
  registerClassroomSockets,
} from "./routes/classroomRoutes.js";

// --------------------------------------------------
// APP
// --------------------------------------------------

const app = express();

app.disable("x-powered-by");

// --------------------------------------------------
// SECURITY
// --------------------------------------------------

app.use(helmet());

// --------------------------------------------------
// CORS
// --------------------------------------------------

const origins = (
  process.env.CLIENT_ORIGINS ||
  "http://localhost:8081,http://localhost:19006,http://localhost:5173"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

  
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: origins,
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
});

// Existing classroom socket functionality
registerClassroomSockets(io);

// New student-faculty chat functionality
registerChatSockets(io);

app.set("io", io);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header
      // such as Postman / server-side requests.
      if (!origin) {
        return callback(null, true);
      }

      if (origins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin is not allowed by CORS.")
      );
    },

    credentials: true,
  })
);

// --------------------------------------------------
// BODY PARSERS
// --------------------------------------------------

app.use(
  express.json({
    limit: "5mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
  })
);

// --------------------------------------------------
// API ROOT
// --------------------------------------------------

app.get("/api", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Student-Faculty-Admin API is running",
  });
});

// --------------------------------------------------
// API HEALTH
// --------------------------------------------------

app.get("/api/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Student-Faculty-Admin API is running",
    environment: env.nodeEnv,
  });
});

// --------------------------------------------------
// AUTH RATE LIMITER
// --------------------------------------------------
//
// Rate limiting should mainly protect authentication
// endpoints instead of blocking the complete API.
//
// This prevents repeated login attempts from abusing
// the authentication system while allowing normal
// faculty/student/admin API requests.
//

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  // 30 authentication requests per 15 minutes
  // from one IP.
  max: 30,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many authentication requests, please try again later.",
  },

  skip: (req) => {
    // Allow logout/heartbeat without consuming
    // authentication rate-limit attempts.
    return (
      req.path === "/logout" ||
      req.path === "/heartbeat"
    );
  },
});

// --------------------------------------------------
// APPLY AUTH RATE LIMITER
// --------------------------------------------------

app.use(
  "/api/auth/login",
  authLimiter
);

app.use(
  "/api/auth/register",
  authLimiter
);

app.use(
  "/api/auth/resend-verification",
  authLimiter
);

app.use(
  "/api/auth/forgot-password",
  authLimiter
);

// --------------------------------------------------
// ROUTES
// --------------------------------------------------

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/students",
  studentRoutes
);

app.use(
  "/api/faculty",
  facultyRoutes
);

app.use(
  "/api/classes",
  classRoutes
);

app.use(
  "/api/doubts",
  doubtRoutes
);

app.use(
  "/api/lectures",
  lectureRoutes
);

app.use(
  "/api/materials",
  materialRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/timetable",
  timetableRoutes
);

app.use(
  "/api/departments",
  departmentRoutes
);

app.use(
  "/api/courses",
  courseRoutes
);

app.use(
  "/api/subjects",
  subjectRoutes
);

app.use(
  "/api/submissions",
  submissionRoutes
);

app.use(
  "/api/classrooms",
  classroomRoutes
);

app.use("/api/chat", chatRoutes);

app.use("/api/examinations", examRoutes);

app.use("/api/examination-questions", questionRoutes);

app.use("/api/examination-attempts", examAttemptRoutes);

app.use("/api/examination-evaluation", evaluationRoutes);

// --------------------------------------------------
// TEST ROUTES
// --------------------------------------------------

if (
  env.nodeEnv !== "production" &&
  process.env.ENABLE_TEST_ROUTES === "true"
) {
  app.use(
    "/api/test",
    testRoutes
  );
}

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

app.use(notFound);

app.use(errorHandler);

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const startServer = async () => {
  try {
    if (
      !env.jwtSecret ||
      env.jwtSecret.length < 32
    ) {
      throw new Error(
        "Set JWT_SECRET to a random secret with at least 32 characters in backend/.env"
      );
    }

    await connectDB();

    // Non-blocking: logs whether verification emails can be sent.
    void verifyEmailTransport();

    httpServer.listen(
      env.port,
      "0.0.0.0",
      () => {
        console.log(
          `API listening on port ${env.port}`
        );

        console.log(
          `Environment: ${env.nodeEnv}`
        );

        console.log(
          `API URL: http://localhost:${env.port}/api`
        );

        console.log(
          `Health URL: http://localhost:${env.port}/api/health`
        );
      }
    );
  } catch (error) {
    console.error(
      "Failed to start server:",
      error.message
    );

    process.exit(1);
  }
};

// --------------------------------------------------
// START
// --------------------------------------------------

if (
  process.env.NODE_ENV !== "test"
) {
  startServer();
}

export default app;