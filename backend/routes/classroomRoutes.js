import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import agoraToken from "agora-token";
import mongoose from "mongoose";

import env from "../config/env.js";
import requireAuth from "../middleware/authMiddleware.js";
import Classroom from "../models/Classroom.js";
import ClassroomMessage from "../models/ClassroomMessage.js";
import ClassroomParticipant from "../models/ClassroomParticipant.js";
import Faculty from "../models/Faculty.js";
import Session from "../models/Session.js";
import Student from "../models/Student.js";
import Timetable from "../models/Timetable.js";
import User from "../models/User.js";

const router = express.Router();
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const TOKEN_TTL_SECONDS = 60 * 60;
const { RtcRole, RtcTokenBuilder } = agoraToken;

const roomName = (classroomId) => `classroom:${classroomId}`;

const classDateFor = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
};

const getTimetable = async (id, dateString) => {
  const date = classDateFor(dateString);
  if (!date) return { error: "A valid classDate (YYYY-MM-DD) is required." };
  if (!mongoose.isValidObjectId(id)) {
    return { error: "A valid timetable ID is required." };
  }
  const timetable = await Timetable.findOne({
    _id: id,
    isActive: true,
    dayOfWeek: DAY_NAMES[date.getUTCDay()],
  });
  if (!timetable) {
    return { error: "No active timetable class exists for that date." };
  }
  return { timetable, date };
};

const getRoleProfile = async (user) => {
  if (user.role === "student") {
    const profile = await Student.findOne({ userId: user.id });
    if (!profile) return null;
    return {
      role: "student",
      profile,
      canAttend:
        profile.courseId?.toString() === user.timetable.courseId.toString() &&
        profile.semester === user.timetable.semester &&
        profile.section?.toUpperCase() === user.timetable.section.toUpperCase(),
    };
  }
  if (user.role === "faculty") {
    const profile = await Faculty.findOne({ userId: user.id });
    if (!profile) return null;
    return {
      role: "faculty",
      profile,
      canAttend: profile._id.toString() === user.timetable.facultyId.toString(),
    };
  }
  return { role: user.role, profile: null, canAttend: user.role === "admin" };
};

const authorizeTimetable = async (requestUser, timetable) => {
  const context = await getRoleProfile({ ...requestUser, timetable });
  return context?.canAttend ? context : null;
};

const assertAgoraConfigured = () => {
  if (!env.agoraAppId || !env.agoraAppCertificate) {
    const error = new Error(
      "Live classroom is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE on the server."
    );
    error.statusCode = 503;
    throw error;
  }
};

const setParticipantLeft = async (classroomId, userId) => {
  const participant = await ClassroomParticipant.findOne({
    classroomId,
    userId,
    leftAt: null,
  });
  if (!participant) return;
  const leftAt = new Date();
  participant.leftAt = leftAt;
  participant.durationSeconds = (participant.durationSeconds || 0) + Math.max(
    0,
    Math.floor((leftAt.getTime() - participant.joinedAt.getTime()) / 1000)
  );
  await participant.save();
};

const validateClassroomId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.classroomId)) {
    return res.status(400).json({ success: false, message: "A valid classroom ID is required." });
  }
  return next();
};

const issueRtcCredentials = async ({ classroom, user, role }) => {
  assertAgoraConfigured();
  let participant = await ClassroomParticipant.findOne({
    classroomId: classroom._id,
    userId: user.id,
  });

  if (!participant) {
    participant = await ClassroomParticipant.create({
      classroomId: classroom._id,
      userId: user.id,
      role,
      agoraUid: crypto.randomInt(1, 2 ** 31),
      joinedAt: new Date(),
    });
  } else {
    participant.role = role;
    if (participant.leftAt) {
      participant.joinedAt = new Date();
      participant.leftAt = null;
    }
    await participant.save();
  }

  const token = RtcTokenBuilder.buildTokenWithUid(
    env.agoraAppId,
    env.agoraAppCertificate,
    classroom.channelName,
    participant.agoraUid,
    RtcRole.PUBLISHER,
    TOKEN_TTL_SECONDS,
    TOKEN_TTL_SECONDS
  );

  return {
    classroomId: classroom._id.toString(),
    channelName: classroom.channelName,
    appId: env.agoraAppId,
    token,
    uid: participant.agoraUid,
    tokenExpiresIn: TOKEN_TTL_SECONDS,
  };
};

router.use(requireAuth);

router.get("/timetable/:timetableId/status", async (req, res, next) => {
  try {
    const result = await getTimetable(req.params.timetableId, req.query.classDate);
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    if (!(await authorizeTimetable(req.user, result.timetable))) {
      return res.status(403).json({ success: false, message: "You are not assigned to this class." });
    }
    const classroom = await Classroom.findOne({
      timetableId: result.timetable._id,
      classDate: req.query.classDate,
    }).select("_id status startedAt endedAt");
    return res.json({
      success: true,
      data: classroom
        ? {
            classroomId: classroom._id.toString(),
            status: classroom.status,
            startedAt: classroom.startedAt,
            endedAt: classroom.endedAt,
          }
        : { classroomId: null, status: "scheduled", startedAt: null, endedAt: null },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/timetable/:timetableId/start", async (req, res, next) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ success: false, message: "Only the assigned faculty can start this class." });
    }
    assertAgoraConfigured();
    const result = await getTimetable(req.params.timetableId, req.body.classDate);
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    const access = await authorizeTimetable(req.user, result.timetable);
    if (!access) {
      return res.status(403).json({ success: false, message: "You are not assigned to this class." });
    }

    let classroom = await Classroom.findOne({
      timetableId: result.timetable._id,
      classDate: req.body.classDate,
    });
    if (classroom?.status === "ended") {
      return res.status(409).json({ success: false, message: "This scheduled class has already ended." });
    }
    if (!classroom) {
      classroom = await Classroom.create({
        timetableId: result.timetable._id,
        classDate: req.body.classDate,
        channelName: `class_${result.timetable._id}_${req.body.classDate.replaceAll("-", "")}`,
        title: result.timetable.title,
        facultyId: result.timetable.facultyId,
        courseId: result.timetable.courseId,
        subjectId: result.timetable.subjectId,
        semester: result.timetable.semester,
        section: result.timetable.section,
        status: "live",
        startedAt: new Date(),
      });
    }

    const credentials = await issueRtcCredentials({
      classroom,
      user: req.user,
      role: "faculty",
    });
    return res.status(200).json({ success: true, data: { ...credentials, title: classroom.title } });
  } catch (error) {
    return next(error);
  }
});

router.post("/timetable/:timetableId/join", async (req, res, next) => {
  try {
    if (!["student", "faculty"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only students and faculty can join a live class." });
    }
    const result = await getTimetable(req.params.timetableId, req.body.classDate);
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    const access = await authorizeTimetable(req.user, result.timetable);
    if (!access) {
      return res.status(403).json({ success: false, message: "You are not assigned to this class." });
    }

    const classroom = await Classroom.findOne({
      timetableId: result.timetable._id,
      classDate: req.body.classDate,
      status: "live",
    });
    if (!classroom) {
      return res.status(409).json({ success: false, message: "The faculty has not started this class yet." });
    }

    const credentials = await issueRtcCredentials({
      classroom,
      user: req.user,
      role: access.role,
    });
    return res.json({ success: true, data: { ...credentials, title: classroom.title } });
  } catch (error) {
    return next(error);
  }
});

router.post("/:classroomId/refresh-token", validateClassroomId, async (req, res, next) => {
  try {
    if (!["student", "faculty"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only class participants can refresh a token." });
    }
    const classroom = await Classroom.findOne({
      _id: req.params.classroomId,
      status: "live",
    });
    if (!classroom) {
      return res.status(404).json({ success: false, message: "Live class not found." });
    }
    const timetable = await Timetable.findById(classroom.timetableId);
    const access = timetable ? await authorizeTimetable(req.user, timetable) : null;
    if (!access) {
      return res.status(403).json({ success: false, message: "You are not assigned to this class." });
    }
    const credentials = await issueRtcCredentials({
      classroom,
      user: req.user,
      role: access.role,
    });
    return res.json({
      success: true,
      data: { ...credentials, title: classroom.title },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:classroomId/leave", validateClassroomId, async (req, res, next) => {
  try {
    await setParticipantLeft(req.params.classroomId, req.user.id);
    req.app.get("io").to(roomName(req.params.classroomId)).emit("classroom:presence-changed");
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/:classroomId/end", validateClassroomId, async (req, res, next) => {
  try {
    if (req.user.role !== "faculty") {
      return res.status(403).json({ success: false, message: "Only faculty can end a class." });
    }
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: "Classroom not found." });
    }
    const timetable = await Timetable.findById(classroom.timetableId);
    const access = timetable ? await authorizeTimetable(req.user, timetable) : null;
    if (!access) {
      return res.status(403).json({ success: false, message: "You are not assigned to this class." });
    }
    if (classroom.status === "live") {
      classroom.status = "ended";
      classroom.endedAt = new Date();
      await classroom.save();
      await ClassroomParticipant.updateMany(
        { classroomId: classroom._id, leftAt: null },
        [
          {
            $set: {
              leftAt: classroom.endedAt,
              durationSeconds: {
                $add: [
                  { $ifNull: ["$durationSeconds", 0] },
                  {
                    $max: [
                      0,
                      {
                        $floor: {
                          $divide: [
                            { $subtract: [classroom.endedAt, "$joinedAt"] },
                            1000,
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ]
      );
      req.app.get("io").to(roomName(classroom._id)).emit("classroom:ended");
    }
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/:classroomId/participants", validateClassroomId, async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: "Classroom not found." });
    }
    const timetable = await Timetable.findById(classroom.timetableId);
    if (!timetable || !(await authorizeTimetable(req.user, timetable))) {
      return res.status(403).json({ success: false, message: "You cannot view this class." });
    }
    const participants = await ClassroomParticipant.find({
      classroomId: classroom._id,
    })
      .populate("userId", "name role")
      .sort({ joinedAt: 1 })
      .lean();
    return res.json({
      success: true,
      data: participants.map((participant) => ({
        id: participant.userId?._id?.toString() || participant.userId?.toString(),
        name: participant.userId?.name || "Participant",
        role: participant.role,
        joinedAt: participant.joinedAt,
        leftAt: participant.leftAt,
        durationSeconds: participant.durationSeconds,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:classroomId/messages", validateClassroomId, async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: "Classroom not found." });
    }
    const timetable = await Timetable.findById(classroom.timetableId);
    if (!timetable || !(await authorizeTimetable(req.user, timetable))) {
      return res.status(403).json({ success: false, message: "You cannot view this class." });
    }
    const messages = await ClassroomMessage.find({
      classroomId: classroom._id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    return next(error);
  }
});

export const registerClassroomSockets = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !env.jwtSecret) {
        return next(new Error("Authentication required."));
      }
      const claims = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
      const user = await User.findById(claims.userId);
      if (
        !user ||
        !user.isActive ||
        user.role !== claims.role ||
        user.mustChangePassword
      ) {
        return next(new Error("Session is invalid."));
      }
      const sessionId = claims.sessionId || `legacy-${user._id.toString()}`;
      const session = await Session.findOne({
        sessionId,
        userId: user._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).select("_id");
      if (!session) return next(new Error("Session is invalid."));

      socket.data.user = {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
      };
      return next();
    } catch (error) {
      if (!["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(error.name)) {
        console.error("Classroom socket authentication failed:", error);
      }
      return next(new Error("Authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("classroom:join", async (payload, acknowledge) => {
      try {
        const classroomId = payload?.classroomId;
        if (typeof classroomId !== "string") throw new Error("Invalid classroom.");
        const classroom = await Classroom.findOne({
          _id: classroomId,
          status: "live",
        });
        if (!classroom) throw new Error("Live class not found.");
        const timetable = await Timetable.findById(classroom.timetableId);
        const access = timetable
          ? await authorizeTimetable(socket.data.user, timetable)
          : null;
        const participant = await ClassroomParticipant.findOne({
          classroomId,
          userId: socket.data.user.id,
          leftAt: null,
        });
        if (!access || !participant) throw new Error("You are not an active participant.");

        socket.data.agoraUid = participant.agoraUid;
        await socket.join(roomName(classroomId));
        const connectedSockets = await io.in(roomName(classroomId)).fetchSockets();
        socket.emit(
          "classroom:screen-sharing-state",
          connectedSockets
            .filter((connectedSocket) => connectedSocket.data.screenSharing)
            .map((connectedSocket) => connectedSocket.data.agoraUid)
        );
        if (typeof acknowledge === "function") acknowledge({ success: true });
        io.to(roomName(classroomId)).emit("classroom:presence-changed");
      } catch (error) {
        if (typeof acknowledge === "function") {
          acknowledge({ success: false, message: error.message });
        }
      }
    });

    socket.on("classroom:screen-sharing", (payload) => {
      if (
        typeof payload?.classroomId !== "string" ||
        typeof payload?.sharing !== "boolean" ||
        !socket.rooms.has(roomName(payload.classroomId)) ||
        !Number.isSafeInteger(socket.data.agoraUid)
      ) {
        return;
      }
      socket.data.screenSharing = payload.sharing;
      io.to(roomName(payload.classroomId)).emit("classroom:screen-sharing", {
        uid: socket.data.agoraUid,
        sharing: payload.sharing,
      });
    });

    socket.on("classroom:message", async (payload) => {
      try {
        const classroomId = payload?.classroomId;
        const message = typeof payload?.message === "string" ? payload.message.trim() : "";
        if (
          !socket.rooms.has(roomName(classroomId)) ||
          !message ||
          message.length > 2000 ||
          !["student", "faculty"].includes(socket.data.user.role)
        ) {
          return;
        }
        const classroom = await Classroom.findOne({
          _id: classroomId,
          status: "live",
        });
        const participant = await ClassroomParticipant.findOne({
          classroomId,
          userId: socket.data.user.id,
          leftAt: null,
        });
        if (!classroom || !participant) return;

        const saved = await ClassroomMessage.create({
          classroomId,
          userId: socket.data.user.id,
          senderName: socket.data.user.name,
          senderRole: socket.data.user.role,
          message,
        });
        io.to(roomName(classroomId)).emit("classroom:message", {
          _id: saved._id.toString(),
          classroomId,
          userId: socket.data.user.id,
          senderName: saved.senderName,
          senderRole: saved.senderRole,
          message: saved.message,
          createdAt: saved.createdAt,
        });
      } catch (error) {
        console.error("Unable to persist classroom message:", error);
        socket.emit("classroom:error", { message: "Unable to send your message." });
      }
    });

    socket.on("disconnecting", async () => {
      try {
        for (const room of socket.rooms) {
          if (!room.startsWith("classroom:")) continue;
          const classroomId = room.slice("classroom:".length);
          await setParticipantLeft(classroomId, socket.data.user.id);
          io.to(room).emit("classroom:presence-changed");
          socket.data.screenSharing = false;
          io.to(room).emit("classroom:screen-sharing", {
            uid: socket.data.agoraUid,
            sharing: false,
          });
        }
      } catch (error) {
        console.error("Unable to update classroom attendance on disconnect:", error);
      }
    });
  });
};

export default router;
