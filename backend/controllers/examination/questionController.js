
import Exam from "../../models/examination/Exam.js";
import Question from "../../models/examination/Question.js";

const getUserId = (req) => req.user?.id;
const getRole = (req) => String(req.user?.role || "").toLowerCase();

const isAdmin = (req) => getRole(req) === "admin";

const canManageExam = (exam) =>
  isAdmin({ user: { role: "admin" } }) ||
  String(exam.createdBy) === String(getUserIdForCheck);

let getUserIdForCheck = null;

const verifyExamAccess = async (req, res) => {
  const exam = await Exam.findById(req.params.examId);

  if (!exam) {
    res.status(404).json({
      success: false,
      message: "Exam not found.",
    });
    return null;
  }

  if (
    !isAdmin(req) &&
    (getRole(req) !== "faculty" ||
      String(exam.createdBy) !== String(getUserId(req)))
  ) {
    res.status(403).json({
      success: false,
      message: "You are not allowed to manage this exam.",
    });
    return null;
  }

  if (["completed", "cancelled"].includes(exam.status)) {
    res.status(400).json({
      success: false,
      message: "Questions cannot be changed for this exam.",
    });
    return null;
  }

  return exam;
};

const validateQuestion = (data) => {
  const {
    questionText,
    questionType,
    options,
    correctAnswer,
    marks,
  } = data;

  if (!questionText?.trim()) {
    return "Question text is required.";
  }

  if (!["mcq", "descriptive"].includes(questionType)) {
    return "Question type must be mcq or descriptive.";
  }

  if (typeof marks !== "number" || marks <= 0) {
    return "Marks must be a positive number.";
  }

  if (questionType === "mcq") {
    if (!Array.isArray(options) || options.length < 2) {
      return "MCQ questions need at least two options.";
    }

    if (options.some((option) => !option?.optionText?.trim())) {
      return "Every option must contain optionText.";
    }

    const answerExists = options.some(
      (option) => option.optionText === correctAnswer
    );

    if (!answerExists) {
      return "Correct answer must match one of the options.";
    }
  }

  if (questionType === "descriptive" && options?.length) {
    return "Descriptive questions should not contain options.";
  }

  return null;
};

// ADD QUESTION
export const addQuestion = async (req, res) => {
  try {
    const exam = await verifyExamAccess(req, res);
    if (!exam) return;

    const validationError = validateQuestion(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const {
      questionText,
      questionType,
      options,
      correctAnswer,
      marks,
      negativeMarks,
      explanation,
      order,
    } = req.body;

    const question = await Question.create({
      examId: exam._id,
      questionText: questionText.trim(),
      questionType,
      options: questionType === "mcq" ? options : [],
      correctAnswer: questionType === "mcq" ? correctAnswer : null,
      marks,
      negativeMarks: negativeMarks || 0,
      explanation: explanation || "",
      order: order ?? (await Question.countDocuments({
        examId: exam._id,
      })),
    });

    exam.questionCount = await Question.countDocuments({
      examId: exam._id,
    });

    await exam.save();

    return res.status(201).json({
      success: true,
      message: "Question added successfully.",
      question,
    });
  } catch (error) {
    console.error("Add question error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add question.",
    });
  }
};

// UPDATE QUESTION
export const updateQuestion = async (req, res) => {
  try {
    const exam = await verifyExamAccess(req, res);
    if (!exam) return;

    const question = await Question.findOne({
      _id: req.params.questionId,
      examId: exam._id,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found.",
      });
    }

    const data = {
      ...question.toObject(),
      ...req.body,
    };

    const validationError = validateQuestion(data);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const allowedFields = [
      "questionText",
      "questionType",
      "options",
      "correctAnswer",
      "marks",
      "negativeMarks",
      "explanation",
      "order",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        question[field] = req.body[field];
      }
    });

    if (question.questionType === "descriptive") {
      question.options = [];
      question.correctAnswer = null;
    }

    await question.save();

    return res.status(200).json({
      success: true,
      message: "Question updated successfully.",
      question,
    });
  } catch (error) {
    console.error("Update question error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update question.",
    });
  }
};

// DELETE QUESTION
export const deleteQuestion = async (req, res) => {
  try {
    const exam = await verifyExamAccess(req, res);
    if (!exam) return;

    const question = await Question.findOneAndDelete({
      _id: req.params.questionId,
      examId: exam._id,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found.",
      });
    }

    exam.questionCount = await Question.countDocuments({
      examId: exam._id,
    });

    await exam.save();

    return res.status(200).json({
      success: true,
      message: "Question deleted successfully.",
    });
  } catch (error) {
    console.error("Delete question error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete question.",
    });
  }
};

// LIST QUESTIONS
export const getQuestions = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const role = getRole(req);

    if (
      role === "faculty" &&
      String(exam.createdBy) !== String(getUserId(req))
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    if (role === "student" && exam.status !== "published") {
      return res.status(403).json({
        success: false,
        message: "This exam is not available.",
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

    if (role === "student") {
      questions = questions.map((question) => {
        const {
          correctAnswer,
          explanation,
          ...safeQuestion
        } = question;

        return safeQuestion;
      });
    }

    return res.status(200).json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error("Get questions error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch questions.",
    });
  }
};
