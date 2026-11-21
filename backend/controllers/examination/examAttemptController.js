
import mongoose from "mongoose";
import Exam from "../../models/examination/Exam.js";
import Question from "../../models/examination/Question.js";
import ExamAttempt from "../../models/examination/ExamAttempt.js";

const getUserId = (req) => req.user?.id;
const getRole = (req) =>
  String(req.user?.role || "").toLowerCase();

const isStudent = (req) => getRole(req) === "student";

const getAttemptExpiry = (exam, startedAt) => {
  const durationExpiry = new Date(
    startedAt.getTime() + exam.duration * 60 * 1000
  );

  return new Date(
    Math.min(
      durationExpiry.getTime(),
      new Date(exam.endTime).getTime()
    )
  );
};

const calculateResult = (attempt, questions, exam) => {
  let obtainedMarks = 0;
  let descriptivePending = false;

  const questionMap = new Map(
    questions.map((question) => [
      String(question._id),
      question,
    ])
  );

  attempt.answers.forEach((answer) => {
    const question = questionMap.get(
      String(answer.questionId)
    );

    if (!question) return;

    if (question.questionType === "mcq") {
      const isCorrect =
        answer.answer.trim() ===
        String(question.correctAnswer || "").trim();

      if (isCorrect) {
        answer.marksAwarded = question.marks;
      } else if (answer.answer.trim() && exam.negativeMarking) {
        answer.marksAwarded = -(
          question.negativeMarks || exam.negativeMarks || 0
        );
      } else {
        answer.marksAwarded = 0;
      }

      answer.isEvaluated = true;
      obtainedMarks += answer.marksAwarded;
    } else {
      answer.isEvaluated = false;
      descriptivePending = true;
    }
  });

  const totalMarks = exam.totalMarks;
  const percentage =
    totalMarks > 0
      ? Math.max(0, (obtainedMarks / totalMarks) * 100)
      : 0;

  attempt.obtainedMarks = Math.max(0, obtainedMarks);
  attempt.totalMarks = totalMarks;
  attempt.percentage = Number(percentage.toFixed(2));

  attempt.status = descriptivePending
    ? "submitted"
    : "evaluated";

  attempt.resultPublished =
    exam.showResultImmediately && !descriptivePending;
};

const getStudentExam = async (examId, res) => {
  if (!mongoose.Types.ObjectId.isValid(examId)) {
    res.status(400).json({
      success: false,
      message: "Invalid exam ID.",
    });
    return null;
  }

  const exam = await Exam.findById(examId);

  if (!exam || exam.status !== "published") {
    res.status(404).json({
      success: false,
      message: "Published exam not found.",
    });
    return null;
  }

  return exam;
};

// START EXAM
export const startExam = async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({
        success: false,
        message: "Only students can start an exam.",
      });
    }

    const exam = await getStudentExam(req.params.examId, res);
    if (!exam) return;

    const now = new Date();

    if (
      now < new Date(exam.startTime) ||
      now > new Date(exam.endTime)
    ) {
      return res.status(400).json({
        success: false,
        message: "This exam is not currently available.",
      });
    }

    let attempt = await ExamAttempt.findOne({
      examId: exam._id,
      studentId: getUserId(req),
    });

    if (attempt) {
      if (attempt.status !== "in-progress") {
        return res.status(409).json({
          success: false,
          message: "You have already submitted this exam.",
        });
      }

      if (now >= new Date(attempt.expiresAt)) {
        return res.status(409).json({
          success: false,
          message: "Your exam time has expired. Submit your answers.",
          expired: true,
        });
      }
    } else {
      const expiresAt = getAttemptExpiry(exam, now);

      try {
        attempt = await ExamAttempt.create({
          examId: exam._id,
          studentId: getUserId(req),
          startedAt: now,
          expiresAt,
          totalMarks: exam.totalMarks,
          status: "in-progress",
        });
      } catch (error) {
        if (error.code !== 11000) throw error;

        attempt = await ExamAttempt.findOne({
          examId: exam._id,
          studentId: getUserId(req),
        });
      }
    }

    let questions = await Question.find({
      examId: exam._id,
    })
      .select("-correctAnswer -explanation")
      .sort({ order: 1 })
      .lean();

    if (exam.shuffleQuestions) {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }

    return res.status(200).json({
      success: true,
      message: "Exam started successfully.",
      attempt: {
        id: attempt._id,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        status: attempt.status,
        answers: attempt.answers,
      },
      exam: {
        id: exam._id,
        title: exam.title,
        subject: exam.subject,
        duration: exam.duration,
        totalMarks: exam.totalMarks,
        instructions: exam.instructions,
      },
      questions,
    });
  } catch (error) {
    console.error("Start exam error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to start exam.",
    });
  }
};

// SAVE ANSWERS
export const saveAnswers = async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({
        success: false,
        message: "Only students can save exam answers.",
      });
    }

    const { answers } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers must be provided as an array.",
      });
    }

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      studentId: getUserId(req),
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Exam attempt not found.",
      });
    }

    if (attempt.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "This exam has already been submitted.",
      });
    }

    if (new Date() >= new Date(attempt.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: "Exam time has expired. Submit your answers.",
        expired: true,
      });
    }

    const exam = await Exam.findById(attempt.examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const questions = await Question.find({
      examId: exam._id,
    }).select("_id");

    const validQuestionIds = new Set(
      questions.map((question) => String(question._id))
    );

    for (const item of answers) {
      if (
        !item ||
        !mongoose.Types.ObjectId.isValid(item.questionId) ||
        typeof item.answer !== "string" ||
        !validQuestionIds.has(String(item.questionId))
      ) {
        return res.status(400).json({
          success: false,
          message: "One or more answers are invalid.",
        });
      }
    }

    for (const item of answers) {
      const existing = attempt.answers.find(
        (answer) =>
          String(answer.questionId) === String(item.questionId)
      );

      if (existing) {
        existing.answer = item.answer;
      } else {
        attempt.answers.push({
          questionId: item.questionId,
          answer: item.answer,
        });
      }
    }

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: "Answers saved successfully.",
      savedAt: new Date(),
    });
  } catch (error) {
    console.error("Save answers error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save answers.",
    });
  }
};

// SUBMIT EXAM
export const submitExam = async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({
        success: false,
        message: "Only students can submit an exam.",
      });
    }

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      studentId: getUserId(req),
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Exam attempt not found.",
      });
    }

    if (attempt.status !== "in-progress") {
      return res.status(409).json({
        success: false,
        message: "This exam has already been submitted.",
      });
    }

    const exam = await Exam.findById(attempt.examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    // Accept final answers if the deadline has just passed;
    // the server still controls the submission time.
    const now = new Date();

    if (Array.isArray(req.body.answers)) {
      const questionsForValidation = await Question.find({
        examId: exam._id,
      }).select("_id");

      const validIds = new Set(
        questionsForValidation.map((q) => String(q._id))
      );

      for (const item of req.body.answers) {
        if (
          !item ||
          !mongoose.Types.ObjectId.isValid(item.questionId) ||
          typeof item.answer !== "string" ||
          !validIds.has(String(item.questionId))
        ) {
          return res.status(400).json({
            success: false,
            message: "One or more submitted answers are invalid.",
          });
        }
      }

      for (const item of req.body.answers) {
        const existing = attempt.answers.find(
          (answer) =>
            String(answer.questionId) === String(item.questionId)
        );

        if (existing) {
          existing.answer = item.answer;
        } else {
          attempt.answers.push({
            questionId: item.questionId,
            answer: item.answer,
          });
        }
      }
    }

    const questions = await Question.find({
      examId: exam._id,
    });

    calculateResult(attempt, questions, exam);

    const autoSubmitted = now >= new Date(attempt.expiresAt);

    attempt.status = autoSubmitted
      ? "auto-submitted"
      : attempt.status;

    attempt.submittedAt = now;

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: autoSubmitted
        ? "Exam was automatically submitted."
        : "Exam submitted successfully.",
      result: attempt.resultPublished
        ? {
            obtainedMarks: attempt.obtainedMarks,
            totalMarks: attempt.totalMarks,
            percentage: attempt.percentage,
            status: attempt.status,
          }
        : {
            message: "Your answers have been submitted for evaluation.",
          },
    });
  } catch (error) {
    console.error("Submit exam error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit exam.",
    });
  }
};

// STUDENT EXAM HISTORY
export const getMyAttempts = async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({
        success: false,
        message: "Only students can view their exam history.",
      });
    }

    const attempts = await ExamAttempt.find({
      studentId: getUserId(req),
    })
      .populate("examId", "title subject startTime endTime")
      .select("-answers")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: attempts.length,
      attempts: attempts.map((attempt) => ({
        ...attempt,
        // Hide marks until the result is published.
        obtainedMarks: attempt.resultPublished
          ? attempt.obtainedMarks
          : null,
        percentage: attempt.resultPublished
          ? attempt.percentage
          : null,
      })),
    });
  } catch (error) {
    console.error("Exam history error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch exam history.",
    });
  }
};
