import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import requireAuth from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";

import User from "../models/User.js";
import Student from "../models/Student.js";
import Faculty from "../models/Faculty.js";
import ClassModel from "../models/Class.js";
import Doubt from "../models/Doubt.js";
import Session from "../models/Session.js";
import EmployeeSchedule from "../models/EmployeeSchedule.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

// ======================================================
// HELPERS
// ======================================================

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isOptionalProfileText = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim().length <= 100);
const isValidJoiningDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
};

const isStrongPassword = (password) => {
  return (
    typeof password === "string" &&
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

// ======================================================
// DASHBOARD
// ======================================================

router.get("/dashboard", async (_req, res, next) => {
  try {
    const activeSince = new Date(Date.now() - 5 * 60 * 1000);

    const [
      users,
      students,
      faculty,
      classes,
      openDoubts,
      activeUserIds,
    ] = await Promise.all([
      User.countDocuments(),
      Student.countDocuments(),
      Faculty.countDocuments(),
      ClassModel.countDocuments(),
      Doubt.countDocuments({ status: "pending" }),
      Session.distinct("userId", {
        revokedAt: null,
        lastActivityAt: { $gte: activeSince },
      }),
    ]);

    const activeSessions = await User.countDocuments({
      _id: { $in: activeUserIds },
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        users,
        students,
        faculty,
        classes,
        openDoubts,
        activeSessions,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// GET ALL EMPLOYEES
// ======================================================

router.get("/employees", async (_req, res, next) => {
  try {
    const employees = await Faculty.find()
      .populate(
        "userId",
        "name email isActive mustChangePassword"
      )
      .populate("departmentId", "name code")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// GET SINGLE EMPLOYEE
// ======================================================

router.get("/employees/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    const employee = await Faculty.findById(req.params.id)
      .populate(
        "userId",
        "name email isActive mustChangePassword"
      )
      .populate("departmentId", "name code")
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// ADD EMPLOYEE
// ======================================================

router.post("/employees", async (req, res, next) => {
  let createdUser = null;

  try {
    const {
      name,
      email,
      password,
      designation = "Faculty",
      departmentId,
      phone,
      qualification,
      specialization,
      joiningDate,
    } = req.body;

    // ---------------- VALIDATION ----------------

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must contain between 2 and 100 characters.",
      });
    }

    if (
      typeof email !== "string" ||
      !emailPattern.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 12–128 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    if (
      typeof designation !== "string" ||
      !designation.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Designation is required.",
      });
    }

    if (
      departmentId &&
      !mongoose.isValidObjectId(departmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID.",
      });
    }

    if (
      !isOptionalProfileText(qualification) ||
      !isOptionalProfileText(specialization)
    ) {
      return res.status(400).json({
        success: false,
        message: "Qualification and specialization must be 100 characters or fewer.",
      });
    }

    if (!isValidJoiningDate(joiningDate)) {
      return res.status(400).json({
        success: false,
        message: "Joining date must be a valid date in YYYY-MM-DD format.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ---------------- CHECK EXISTING USER ----------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    // ---------------- CREATE USER ----------------

    createdUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: "faculty",
      mustChangePassword: true,
    });

    // ---------------- CREATE FACULTY ----------------

    const idSuffix = createdUser._id
      .toString()
      .slice(-8)
      .toUpperCase();

    const faculty = await Faculty.create({
      userId: createdUser._id,
      facultyId: `FAC${idSuffix}`,
      employeeId: `EMP${idSuffix}`,
      designation: designation.trim(),
      departmentId: departmentId || null,
      phone:
        typeof phone === "string" && phone.trim()
          ? phone.trim()
          : null,
      qualification:
        typeof qualification === "string" && qualification.trim()
          ? qualification.trim()
          : null,
      specialization:
        typeof specialization === "string" && specialization.trim()
          ? specialization.trim()
          : null,
      joiningDate: joiningDate ? new Date(`${joiningDate}T00:00:00.000Z`) : null,
    });

    // ---------------- RESPONSE ----------------

    const employee = await Faculty.findById(faculty._id)
      .populate(
        "userId",
        "name email isActive mustChangePassword"
      )
      .populate("departmentId", "name code")
      .lean();

    res.status(201).json({
      success: true,
      message: "Employee added successfully.",
      data: employee,
    });
  } catch (error) {
    if (createdUser) {
      await EmployeeSchedule.deleteMany({
        userId: createdUser._id,
      });

      await Faculty.deleteOne({
        userId: createdUser._id,
      });

      await User.deleteOne({
        _id: createdUser._id,
      });
    }

    if (error.code === 11000) {
      error.statusCode = 409;
    }

    next(error);
  }
});

// ======================================================
// EDIT EMPLOYEE
// PATCH /api/admin/employees/:id
// ======================================================

// ======================================================
// EDIT EMPLOYEE
// PATCH /api/admin/employees/:id
// ======================================================

router.patch("/employees/:id", async (req, res, next) => {
  try {
    // ---------------- VALIDATE ID ----------------

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    // ---------------- FIND FACULTY ----------------

    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const {
      name,
      email,
      password,
      designation,
      departmentId,
      phone,
      qualification,
      specialization,
      joiningDate,
      isActive,
    } = req.body;

    // ---------------- VALIDATE NAME ----------------

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name must contain between 2 and 100 characters.",
        });
      }
    }

    // ---------------- VALIDATE EMAIL ----------------

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !emailPattern.test(email.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
      }
    }

    // ---------------- VALIDATE PASSWORD ----------------

    if (password !== undefined && password !== "") {
      if (!isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be 12–128 characters and include uppercase, lowercase, number, and special character.",
        });
      }
    }

    // ---------------- VALIDATE DESIGNATION ----------------

    if (designation !== undefined) {
      if (
        typeof designation !== "string" ||
        !designation.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Designation cannot be empty.",
        });
      }
    }

    // ---------------- VALIDATE DEPARTMENT ----------------

    if (
      departmentId !== undefined &&
      departmentId !== null &&
      departmentId !== "" &&
      !mongoose.isValidObjectId(departmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID.",
      });
    }

    if (
      !isOptionalProfileText(qualification) ||
      !isOptionalProfileText(specialization)
    ) {
      return res.status(400).json({
        success: false,
        message: "Qualification and specialization must be 100 characters or fewer.",
      });
    }

    if (!isValidJoiningDate(joiningDate)) {
      return res.status(400).json({
        success: false,
        message: "Joining date must be a valid date in YYYY-MM-DD format.",
      });
    }

    // ---------------- VALIDATE STATUS ----------------

    if (
      isActive !== undefined &&
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean.",
      });
    }

    // ---------------- FIND USER ----------------

    const user = await User.findById(faculty.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Associated user account not found.",
      });
    }

    // Make sure this really is a faculty employee.
    if (user.role !== "faculty") {
      return res.status(400).json({
        success: false,
        message:
          "The associated account is not a faculty employee.",
      });
    }

    // ---------------- EMAIL DUPLICATE CHECK ----------------

    if (email !== undefined) {
      const normalizedEmail =
        email.trim().toLowerCase();

      const emailOwner = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (emailOwner) {
        return res.status(409).json({
          success: false,
          message:
            "Another user already uses this email.",
        });
      }

      user.email = normalizedEmail;
    }

    // ---------------- UPDATE NAME ----------------

    if (name !== undefined) {
      user.name = name.trim();
    }

    // ---------------- UPDATE STATUS ----------------

    if (isActive !== undefined) {
      user.isActive = isActive;

      // If employee is deactivated,
      // immediately revoke all active sessions.
      if (!isActive) {
        await Session.updateMany(
          {
            userId: user._id,
            revokedAt: null,
          },
          {
            $set: {
              revokedAt: new Date(),
            },
          }
        );
      }
    }

    // ---------------- UPDATE PASSWORD ----------------

    if (
      password !== undefined &&
      password !== ""
    ) {
      user.passwordHash =
        await bcrypt.hash(password, 12);

      /*
       * IMPORTANT:
       *
       * Admin has explicitly set/reset the employee password.
       * Therefore do NOT leave the account stuck at
       * "Temporary password pending".
       */
      user.mustChangePassword = false;

      // Password changed -> revoke old sessions.
      await Session.updateMany(
        {
          userId: user._id,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        }
      );
    }

    await user.save();

    // ---------------- UPDATE FACULTY ----------------

    if (designation !== undefined) {
      faculty.designation =
        designation.trim();
    }

    if (departmentId !== undefined) {
      faculty.departmentId =
        departmentId || null;
    }

    if (phone !== undefined) {
      faculty.phone =
        typeof phone === "string" &&
        phone.trim()
          ? phone.trim()
          : null;
    }

    if (qualification !== undefined) {
      faculty.qualification =
        typeof qualification === "string" && qualification.trim()
          ? qualification.trim()
          : null;
    }

    if (specialization !== undefined) {
      faculty.specialization =
        typeof specialization === "string" && specialization.trim()
          ? specialization.trim()
          : null;
    }

    if (joiningDate !== undefined) {
      faculty.joiningDate = joiningDate
        ? new Date(`${joiningDate}T00:00:00.000Z`)
        : null;
    }

    await faculty.save();

    // ---------------- GET UPDATED EMPLOYEE ----------------

    const updatedEmployee =
      await Faculty.findById(faculty._id)
        .populate(
          "userId",
          "name email isActive mustChangePassword"
        )
        .populate(
          "departmentId",
          "name code"
        )
        .lean();

    res.json({
      success: true,
      message:
        password !== undefined &&
        password !== ""
          ? "Employee updated and password set successfully."
          : "Employee updated successfully.",
      data: updatedEmployee,
    });
  } catch (error) {
    if (error.code === 11000) {
      error.statusCode = 409;
    }

    next(error);
  }
});

// ======================================================
// DELETE EMPLOYEE
// DELETE /api/admin/employees/:id
// ======================================================

// ======================================================
// DELETE EMPLOYEE
// DELETE /api/admin/employees/:id
// ======================================================

router.delete("/employees/:id", async (req, res, next) => {
  try {
    // ---------------- VALIDATE ID ----------------

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    // ---------------- FIND FACULTY ----------------

    const faculty =
      await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const userId = faculty.userId;

    // ---------------- FIND USER ----------------

    const user =
      await User.findById(userId);

    if (!user) {
      // Remove orphaned faculty record if it exists.
      await Faculty.deleteOne({
        _id: faculty._id,
      });

      await EmployeeSchedule.deleteMany({
        userId,
      });

      return res.status(404).json({
        success: false,
        message:
          "Employee account was not found. Orphaned employee record was removed.",
      });
    }

    // Do not allow this route to accidentally delete
    // an account belonging to another role.
    if (user.role !== "faculty") {
      return res.status(400).json({
        success: false,
        message:
          "This account is not a faculty employee.",
      });
    }

    // ---------------- DELETE SCHEDULES ----------------

    await EmployeeSchedule.deleteMany({
      userId,
    });

    // ---------------- REVOKE SESSIONS ----------------

    await Session.updateMany(
      {
        userId,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      }
    );

    // ---------------- DELETE FACULTY ----------------

    const facultyDeleteResult =
      await Faculty.deleteOne({
        _id: faculty._id,
      });

    if (
      facultyDeleteResult.deletedCount !== 1
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Employee record could not be deleted.",
      });
    }

    // ---------------- DELETE USER ----------------

    const userDeleteResult =
      await User.deleteOne({
        _id: userId,
        role: "faculty",
      });

    if (
      userDeleteResult.deletedCount !== 1
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Employee profile was deleted, but the user account could not be deleted.",
      });
    }

    res.json({
      success: true,
      message:
        "Employee and associated account, schedules, and sessions deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// ACTIVE SESSIONS
// ======================================================

router.get("/active-sessions", async (_req, res, next) => {
  try {
    const activeSince = new Date(Date.now() - 5 * 60 * 1000);

    const sessions = await Session.find({
      revokedAt: null,
      lastActivityAt: {
        $gte: activeSince,
      },
    })
      .populate(
        "userId",
        "name email role isActive"
      )
      .sort({
        lastActivityAt: -1,
      })
      .lean();

    const users = new Map();

    for (const session of sessions) {
      const user = session.userId;

      if (
        user?.isActive &&
        !users.has(user._id.toString())
      ) {
        users.set(user._id.toString(), {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastActivityAt: session.lastActivityAt,
        });
      }
    }

    res.json({
      success: true,
      data: [...users.values()],
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// GET SCHEDULES
// ======================================================

router.get("/schedules", async (_req, res, next) => {
  try {
    const schedules = await EmployeeSchedule.find()
      .populate("userId", "name email")
      .sort({
        dayOfWeek: 1,
        startTime: 1,
      })
      .lean();

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// ADD SCHEDULE
// ======================================================

router.post("/schedules", async (req, res, next) => {
  try {
    const {
      title,
      facultyEmail,
      dayOfWeek,
      startTime,
      endTime,
      location = "",
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title is required and must be 150 characters or fewer.",
      });
    }

    if (
      typeof facultyEmail !== "string" ||
      !emailPattern.test(facultyEmail.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid faculty email.",
      });
    }

    if (!days.includes(dayOfWeek)) {
      return res.status(400).json({
        success: false,
        message: "Invalid weekday.",
      });
    }

    if (
      !timePattern.test(startTime) ||
      !timePattern.test(endTime) ||
      startTime >= endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter valid start/end times in HH:MM format. End time must be later than start time.",
      });
    }

    if (
      typeof location !== "string" ||
      location.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Location must be 100 characters or fewer.",
      });
    }

    const employeeUser = await User.findOne({
      email: facultyEmail.trim().toLowerCase(),
      role: "faculty",
      isActive: true,
    }).select("_id");

    if (
      !employeeUser ||
      !(await Faculty.exists({
        userId: employeeUser._id,
      }))
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Active faculty employee not found for that email.",
      });
    }

    const conflictingSchedule =
      await EmployeeSchedule.exists({
        userId: employeeUser._id,
        dayOfWeek,
        startTime: {
          $lt: endTime,
        },
        endTime: {
          $gt: startTime,
        },
      });

    if (conflictingSchedule) {
      return res.status(409).json({
        success: false,
        message:
          "This employee already has a schedule during that time.",
      });
    }

    const schedule = await EmployeeSchedule.create({
      title: title.trim(),
      userId: employeeUser._id,
      dayOfWeek,
      startTime,
      endTime,
      location: location.trim(),
    });

    await schedule.populate(
      "userId",
      "name email"
    );

    res.status(201).json({
      success: true,
      message: "Schedule added successfully.",
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// EDIT SCHEDULE
// ======================================================

router.patch("/schedules/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    const schedule = await EmployeeSchedule.findById(
      req.params.id
    );

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found.",
      });
    }

    const {
      title,
      facultyEmail,
      dayOfWeek,
      startTime,
      endTime,
      location,
    } = req.body;

    const finalTitle =
      title !== undefined
        ? title.trim()
        : schedule.title;

    const finalDay =
      dayOfWeek !== undefined
        ? dayOfWeek
        : schedule.dayOfWeek;

    const finalStart =
      startTime !== undefined
        ? startTime
        : schedule.startTime;

    const finalEnd =
      endTime !== undefined
        ? endTime
        : schedule.endTime;

    const finalLocation =
      location !== undefined
        ? location
        : schedule.location || "";

    if (
      typeof finalTitle !== "string" ||
      !finalTitle ||
      finalTitle.length > 150
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title is required and must be 150 characters or fewer.",
      });
    }

    if (!days.includes(finalDay)) {
      return res.status(400).json({
        success: false,
        message: "Invalid weekday.",
      });
    }

    if (
      !timePattern.test(finalStart) ||
      !timePattern.test(finalEnd) ||
      finalStart >= finalEnd
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter valid start/end times in HH:MM format. End time must be later than start time.",
      });
    }

    if (
      typeof finalLocation !== "string" ||
      finalLocation.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Location must be 100 characters or fewer.",
      });
    }

    let finalUserId = schedule.userId;

    if (facultyEmail !== undefined) {
      if (
        typeof facultyEmail !== "string" ||
        !emailPattern.test(facultyEmail.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid faculty email.",
        });
      }

      const employeeUser = await User.findOne({
        email: facultyEmail.trim().toLowerCase(),
        role: "faculty",
        isActive: true,
      }).select("_id");

      if (
        !employeeUser ||
        !(await Faculty.exists({
          userId: employeeUser._id,
        }))
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Active faculty employee not found for that email.",
        });
      }

      finalUserId = employeeUser._id;
    }

    const conflictingSchedule =
      await EmployeeSchedule.exists({
        _id: {
          $ne: schedule._id,
        },
        userId: finalUserId,
        dayOfWeek: finalDay,
        startTime: {
          $lt: finalEnd,
        },
        endTime: {
          $gt: finalStart,
        },
      });

    if (conflictingSchedule) {
      return res.status(409).json({
        success: false,
        message:
          "This employee already has another schedule during that time.",
      });
    }

    schedule.title = finalTitle;
    schedule.userId = finalUserId;
    schedule.dayOfWeek = finalDay;
    schedule.startTime = finalStart;
    schedule.endTime = finalEnd;
    schedule.location = finalLocation.trim();

    await schedule.save();

    await schedule.populate(
      "userId",
      "name email"
    );

    res.json({
      success: true,
      message: "Schedule updated successfully.",
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// DELETE SCHEDULE
// ======================================================

router.delete("/schedules/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    const schedule = await EmployeeSchedule.findById(
      req.params.id
    );

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found.",
      });
    }

    await EmployeeSchedule.deleteOne({
      _id: schedule._id,
    });

    res.json({
      success: true,
      message: "Schedule deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// USER STATUS
// ======================================================

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isActive: req.body.isActive,
      },
      {
        new: true,
      }
    ).select("name email role isActive");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.isActive) {
      await Session.updateMany(
        {
          userId: user._id,
          revokedAt: null,
        },
        {
          revokedAt: new Date(),
        }
      );
    }

    res.json({
      success: true,
      message: user.isActive
        ? "User activated successfully."
        : "User deactivated successfully.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// GET USERS
// ======================================================

router.get("/users", async (req, res, next) => {
  try {
    const page = Math.max(
      1,
      Number(req.query.page) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number(req.query.limit) || 50
      )
    );

    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "name email role isActive lastLogin createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;