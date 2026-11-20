import express from "express";
import mongoose from "mongoose";

import Timetable from "../models/Timetable.js";
import Faculty from "../models/Faculty.js";
import Student from "../models/Student.js";
import requireAuth from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";
import resourceRoutes from "./resourceRoutes.js";

const router = express.Router();

// --------------------------------------------------
// AUTH
// --------------------------------------------------

router.use(requireAuth);

// --------------------------------------------------
// FACULTY TIMETABLE
// GET /api/timetable/faculty
// --------------------------------------------------

router.get(
  "/faculty",
  allowRoles("faculty"),
  async (req, res, next) => {
    try {
      const facultyProfile = await Faculty.findOne({ userId: req.user.id }).select('_id');
      const facultyId = facultyProfile?._id;

      if (!facultyId || !mongoose.isValidObjectId(facultyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid faculty ID.",
        });
      }

      const schedules = await Timetable.find({
        facultyId,
        isActive: true,
      })
        .populate("departmentId", "name")
        .populate("courseId", "name")
        .populate("subjectId", "name")
        .populate("facultyId", "name email")
        .sort({
          dayOfWeek: 1,
          startTime: 1,
        })
        .lean();

      return res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// SET / CLEAR VIDEO CLASS LINK (faculty who owns the slot, or admin)
// PATCH /api/timetable/:id/meeting-link   { meetingUrl }
// Students see this link on their Live Classes page and can join directly.
// --------------------------------------------------

router.patch(
  "/:id/meeting-link",
  allowRoles("faculty", "admin"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid timetable ID." });
      }

      let meetingUrl = typeof req.body?.meetingUrl === "string" ? req.body.meetingUrl.trim() : "";

      if (meetingUrl) {
        // Allow "meet.google.com/abc" typed without a scheme.
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(meetingUrl)) meetingUrl = `https://${meetingUrl}`;
        let parsed;
        try {
          parsed = new URL(meetingUrl);
        } catch {
          return res.status(400).json({ success: false, message: "Enter a valid video link (e.g. https://meet.google.com/abc-defg-hij)." });
        }
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ success: false, message: "Video link must start with http:// or https://" });
        }
        meetingUrl = parsed.toString();
      }

      const entry = await Timetable.findById(req.params.id);
      if (!entry) {
        return res.status(404).json({ success: false, message: "Timetable entry not found." });
      }

      if (req.user.role === "faculty") {
        const profile = await Faculty.findOne({ userId: req.user.id }).select("_id");
        if (!profile || String(entry.facultyId) !== String(profile._id)) {
          return res.status(403).json({ success: false, message: "You can only add links to your own classes." });
        }
      }

      entry.meetingUrl = meetingUrl;
      await entry.save();

      return res.json({
        success: true,
        message: meetingUrl ? "Video link saved. Students can now join from their Live Classes page." : "Video link removed.",
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  allowRoles("student"),
  async (req, res, next) => {
    try {
      const student = await Student.findOne({ userId: req.user.id })
        .select("courseId departmentId semester section")
        .lean();

      if (!student) {
        return res.json({ success: true, data: [] });
      }

      const filter = { isActive: true };
      if (student.courseId) {
        filter.courseId = student.courseId;
      } else if (student.departmentId) {
        filter.departmentId = student.departmentId;
      }
      if (Number.isInteger(student.semester)) {
        filter.semester = student.semester;
      }
      if (student.section?.trim()) {
        const escapedSection = student.section.trim().replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        filter.section = { $regex: `^${escapedSection}$`, $options: "i" };
      }

      const schedules = await Timetable.find(filter)
        .sort({ dayOfWeek: 1, startTime: 1 })
        .lean();

      return res.json({ success: true, data: schedules });
    } catch (error) {
      return next(error);
    }
  }
);

// --------------------------------------------------
// GENERIC TIMETABLE CRUD
// --------------------------------------------------

const crudRouter = resourceRoutes(Timetable, {
  read: ["student", "faculty", "admin"],
  create: ["faculty", "admin"],
  update: ["faculty", "admin"],
  remove: ["admin"],
});

// --------------------------------------------------
// MOUNT GENERIC CRUD ROUTES
// --------------------------------------------------

router.use("/", crudRouter);

export default router;