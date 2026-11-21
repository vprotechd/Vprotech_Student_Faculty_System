import Exam from "../../models/examination/Exam.js";
import Question from "../../models/examination/Question.js";
import mongoose from "mongoose";

const getUserId = (req) => req.user?.id;
const getUserRole = (req) => String(req.user?.role || "").toLowerCase();

const isStaff = (req) =>
  ["admin", "faculty"].includes(getUserRole(req));

const isAdmin = (req) => getUserRole(req) === "admin";

const handleError = (res, error) => {
  console.error("EXAMINATION API ERROR:", error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid exam ID.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
  });
};

const getExamForStaff = async (req, res) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    res.status(404).json({
      success: false,
      message: "Exam not found.",
    });
    return null;
  }

  if (
    !isAdmin(req) &&
    String(exam.createdBy) !== String(getUserId(req))
  ) {
    res.status(403).json({
      success: false,
      message: "You can only manage exams created by you.",
    });
    return null;
  }

  return exam;
};

// CREATE EXAM
export const createExam = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Only Admin or Faculty can create exams.",
      });
    }

    const {
      title,
      description,
      subject,
      className,
      batch,
      duration,
      totalMarks,
      passingMarks,
      startTime,
      endTime,
      negativeMarking,
      negativeMarks,
      shuffleQuestions,
      showResultImmediately,
      allowRetake,
      instructions,
    } = req.body;

    if (
      !title?.trim() ||
      !subject?.trim() ||
      !className?.trim() ||
      !Number.isFinite(Number(duration)) ||
      Number(duration) < 1 ||
      !Number.isFinite(Number(totalMarks)) ||
      Number(totalMarks) < 1 ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid exam details.",
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid exam start and end times.",
      });
    }

    const exam = await Exam.create({
      title: title.trim(),
      description,
      subject: subject.trim(),
      className: className.trim(),
      batch,
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      passingMarks: Number(passingMarks) || 0,
      startTime: start,
      endTime: end,
      negativeMarking: Boolean(negativeMarking),
      negativeMarks: Number(negativeMarks) || 0,
      shuffleQuestions: Boolean(shuffleQuestions),
      showResultImmediately: Boolean(showResultImmediately),
      allowRetake: Boolean(allowRetake),
      instructions: Array.isArray(instructions) ? instructions : [],
      createdBy: getUserId(req),
      status: "draft",
    });

    return res.status(201).json({
      success: true,
      message: "Exam created successfully.",
      exam,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET EXAMS
export const getExams = async (req, res) => {
  try {
    const role = getUserRole(req);
    let filter = {};

    if (role === "faculty") {
      filter.createdBy = getUserId(req);
    } else if (role === "student") {
      filter.status = "published";
    } else if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view exams.",
      });
    }

    const exams = await Exam.find(filter)
      .select("-__v")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: exams.length,
      exams,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET SINGLE EXAM
export const getExamById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam ID.",
      });
    }

    const exam = await Exam.findById(req.params.id).lean();

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const role = getUserRole(req);
    const isOwner =
      String(exam.createdBy) === String(getUserId(req));

    if (role === "student" && exam.status !== "published") {
      return res.status(403).json({
        success: false,
        message: "This exam is not available.",
      });
    }

    if (role === "faculty" && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You can only view exams created by you.",
      });
    }

    if (!["admin", "faculty", "student"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    let questions = await Question.find({
      examId: exam._id,
    })
      .sort({ order: 1 })
      .lean();

    // Never send answer keys to students through this endpoint.
    if (role === "student") {
      questions = questions.map(
        ({ correctAnswer, explanation, ...safeQuestion }) =>
          safeQuestion
      );
    }

    return res.status(200).json({
      success: true,
      exam,
      questions,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// UPDATE EXAM
export const updateExam = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const exam = await getExamForStaff(req, res);
    if (!exam) return;

    if (["completed", "cancelled"].includes(exam.status)) {
      return res.status(400).json({
        success: false,
        message: "Completed or cancelled exams cannot be updated.",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "subject",
      "className",
      "batch",
      "duration",
      "totalMarks",
      "passingMarks",
      "startTime",
      "endTime",
      "negativeMarking",
      "negativeMarks",
      "shuffleQuestions",
      "showResultImmediately",
      "allowRetake",
      "instructions",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        exam[field] = req.body[field];
      }
    });

    if (
      !exam.title?.trim() ||
      !exam.subject?.trim() ||
      !exam.className?.trim() ||
      Number(exam.duration) < 1 ||
      Number(exam.totalMarks) < 1 ||
      new Date(exam.endTime) <= new Date(exam.startTime)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please check the exam details and date range.",
      });
    }

    await exam.save();

    return res.status(200).json({
      success: true,
      message: "Exam updated successfully.",
      exam,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PUBLISH EXAM
export const publishExam = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const exam = await getExamForStaff(req, res);
    if (!exam) return;

    if (!["draft", "scheduled"].includes(exam.status)) {
      return res.status(400).json({
        success: false,
        message: "Only draft or scheduled exams can be published.",
      });
    }

    const questions = await Question.find({
      examId: exam._id,
    }).select("marks");

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one question before publishing.",
      });
    }

    const questionMarks = questions.reduce(
      (sum, question) => sum + Number(question.marks || 0),
      0
    );

    if (questionMarks !== Number(exam.totalMarks)) {
      return res.status(400).json({
        success: false,
        message: `Question marks total ${questionMarks}, but exam total marks are ${exam.totalMarks}. Please make them equal.`,
      });
    }

    exam.questionCount = questions.length;
    exam.status = "published";

    await exam.save();

    return res.status(200).json({
      success: true,
      message: "Exam published successfully.",
      exam,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// CANCEL EXAM
export const cancelExam = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const exam = await getExamForStaff(req, res);
    if (!exam) return;

    if (exam.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "A completed exam cannot be cancelled.",
      });
    }

    exam.status = "cancelled";
    await exam.save();

    return res.status(200).json({
      success: true,
      message: "Exam cancelled successfully.",
      exam,
    });
  } catch (error) {
    return handleError(res, error);
  }
};