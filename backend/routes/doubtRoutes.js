import express from "express";
import mongoose from "mongoose";

import Doubt from "../models/Doubt.js";
import Faculty from "../models/Faculty.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import Timetable from "../models/Timetable.js";
import { createNotification } from "../services/notificationService.js";
import requireAuth from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";
import resourceRoutes from "./resourceRoutes.js";

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  allowRoles("student", "faculty", "admin"),
  async (req, res, next) => {
    try {
      let filter = {};

      if (req.user.role === "student") {
        const student = await Student.findOne({ userId: req.user.id }).select("_id");
        if (!student) {
          return res.status(404).json({
            success: false,
            message: "Student profile not found.",
          });
        }
        filter = { studentId: student._id };
      } else if (req.user.role === "faculty") {
        const faculty = await Faculty.findOne({ userId: req.user.id }).select("_id");
        if (!faculty) {
          return res.status(404).json({
            success: false,
            message: "Faculty profile not found.",
          });
        }
        filter = { facultyId: faculty._id };
      }

      const doubts = await Doubt.find(filter)
        .populate("subjectId", "name")
        .sort({ createdAt: -1 })
        .lean();

      return res.json({ success: true, data: doubts });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/",
  allowRoles("student"),
  async (req, res, next) => {
    try {
      const { subjectId, title, message } = req.body;

      if (!mongoose.isValidObjectId(subjectId)) {
        return res.status(400).json({
          success: false,
          message: "Select a valid subject.",
        });
      }

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 200 ||
        typeof message !== "string" ||
        !message.trim() ||
        message.trim().length > 5000
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a title and details (up to 200 and 5000 characters).",
        });
      }

      const student = await Student.findOne({ userId: req.user.id });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found.",
        });
      }

      const subject = await Subject.findOne({
        _id: subjectId,
        isActive: true,
      }).select("departmentId courseId semester facultyIds");

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found or is inactive.",
        });
      }

      if (
        (student.departmentId &&
          subject.departmentId.toString() !== student.departmentId.toString()) ||
        (student.courseId &&
          subject.courseId.toString() !== student.courseId.toString()) ||
        (student.semester && subject.semester !== student.semester)
      ) {
        return res.status(403).json({
          success: false,
          message: "This subject is not assigned to your course or semester.",
        });
      }

      let facultyId = null;
      for (const assignedFacultyId of subject.facultyIds) {
        if (await Faculty.exists({ _id: assignedFacultyId })) {
          facultyId = assignedFacultyId;
          break;
        }
      }

      if (!facultyId) {
        const timetableFilter = {
          subjectId: subject._id,
          courseId: subject.courseId,
          semester: subject.semester,
          isActive: true,
        };
        if (student.section) {
          timetableFilter.section = student.section;
        }

        const timetableEntries = await Timetable.find(timetableFilter)
          .select("facultyId")
          .lean();
        const assignedFaculty = await Faculty.findOne({
          _id: { $in: timetableEntries.map((entry) => entry.facultyId) },
        })
          .select("_id")
          .lean();
        facultyId = assignedFaculty?._id;
      }

      if (!facultyId) {
        return res.status(400).json({
          success: false,
          code: "NO_FACULTY_ASSIGNED",
          message: "No faculty is assigned to this subject yet.",
        });
      }

      const doubt = await Doubt.create({
        studentId: student._id,
        facultyId,
        subjectId: subject._id,
        title: title.trim(),
        message: message.trim(),
      });

      try {
        const assignedFaculty = await Faculty.findById(facultyId)
          .select("userId")
          .lean();
        if (!assignedFaculty?.userId) {
          throw new Error("Assigned faculty user was not found.");
        }
        await createNotification({
          recipientId: assignedFaculty.userId,
          recipientRole: "faculty",
          title: "New student doubt",
          message: `A student submitted a doubt: ${title.trim()}`,
          type: "doubt",
        });
      } catch (notificationError) {
        console.error("Unable to notify faculty about a new doubt:", notificationError);
      }

      return res.status(201).json({
        success: true,
        message: "Doubt submitted successfully.",
        data: doubt,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/:id/replies",
  allowRoles("faculty"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid doubt ID.",
        });
      }

      const { message } = req.body;
      if (typeof message !== "string" || !message.trim() || message.trim().length > 5000) {
        return res.status(400).json({
          success: false,
          message: "Enter a reply of up to 5000 characters.",
        });
      }

      const faculty = await Faculty.findOne({ userId: req.user.id }).select("_id");
      if (!faculty) {
        return res.status(404).json({
          success: false,
          message: "Faculty profile not found.",
        });
      }

      const doubt = await Doubt.findOneAndUpdate(
        { _id: req.params.id, facultyId: faculty._id },
        {
          $push: {
            replies: {
              facultyId: faculty._id,
              message: message.trim(),
            },
          },
          $set: { status: "answered" },
        },
        { new: true, runValidators: true }
      )
        .populate("subjectId", "name")
        .lean();

      if (!doubt) {
        return res.status(404).json({
          success: false,
          message: "Doubt not found.",
        });
      }

      try {
        const student = await Student.findById(doubt.studentId)
          .select("userId")
          .lean();
        if (!student?.userId) {
          throw new Error("Student user was not found.");
        }
        await createNotification({
          recipientId: student.userId,
          recipientRole: "student",
          title: "Faculty replied to your doubt",
          message: `Your doubt "${doubt.title}" has a new faculty reply.`,
          type: "doubt",
        });
      } catch (notificationError) {
        console.error("Unable to notify student about a doubt reply:", notificationError);
      }

      return res.json({
        success: true,
        message: "Reply submitted successfully.",
        data: doubt,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/:id",
  allowRoles("student", "faculty", "admin"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid doubt ID.",
        });
      }

      const doubt = await Doubt.findById(req.params.id)
        .populate("subjectId", "name")
        .lean();

      if (!doubt) {
        return res.status(404).json({
          success: false,
          message: "Doubt not found.",
        });
      }

      if (req.user.role === "student") {
        const student = await Student.findOne({ userId: req.user.id }).select("_id");
        if (!student || doubt.studentId.toString() !== student._id.toString()) {
          return res.status(404).json({
            success: false,
            message: "Doubt not found.",
          });
        }
      } else if (req.user.role === "faculty") {
        const faculty = await Faculty.findOne({ userId: req.user.id }).select("_id");
        if (!faculty || doubt.facultyId.toString() !== faculty._id.toString()) {
          return res.status(404).json({
            success: false,
            message: "Doubt not found.",
          });
        }
      }

      return res.json({ success: true, data: doubt });
    } catch (error) {
      return next(error);
    }
  }
);

router.use(
  "/",
  resourceRoutes(Doubt, {
    read: [],
    create: [],
    update: ["admin"],
    remove: ["admin"],
  })
);

export default router;
