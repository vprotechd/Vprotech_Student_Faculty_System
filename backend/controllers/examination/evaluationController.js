
import mongoose from "mongoose";
import Exam from "../../models/examination/Exam.js";
import Question from "../../models/examination/Question.js";
import ExamAttempt from "../../models/examination/ExamAttempt.js";

const getUserId = (req) => req.user?.id;
const getRole = (req) =>
  String(req.user?.role || "").toLowerCase();

const canManageExam = (exam, req) => {
  if (getRole(req) === "admin") return true;

  return (
    getRole(req) === "faculty" &&
    String(exam.createdBy) === String(getUserId(req))
  );
};

const findExamAndCheckAccess = async (req, res) => {
  const exam = await Exam.findById(req.params.examId);

  if (!exam) {
    res.status(404).json({
      success: false,
      message: "Exam not found.",
    });
    return null;
  }

  if (!canManageExam(exam, req)) {
    res.status(403).json({
      success: false,
      message: "You are not allowed to manage this exam.",
    });
    return null;
  }

  return exam;
};

// LIST SUBMITTED STUDENT ATTEMPTS
export const getSubmittedAttempts = async (req, res) => {
  try {
    const exam = await findExamAndCheckAccess(req, res);
    if (!exam) return;

    const attempts = await ExamAttempt.find({
      examId: exam._id,
      status: {
        $in: ["submitted", "auto-submitted", "evaluated"],
      },
    })
      .populate("studentId", "name email")
      .select("-answers")
      .sort({ submittedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: attempts.length,
      attempts: attempts.map((attempt) => ({
        ...attempt,
        obtainedMarks: attempt.resultPublished
          ? attempt.obtainedMarks
          : null,
        percentage: attempt.resultPublished
          ? attempt.percentage
          : null,
      })),
    });
  } catch (error) {
    console.error("Submitted attempts error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch submitted attempts.",
    });
  }
};

// GET ONE ATTEMPT FOR FACULTY EVALUATION
export const getAttemptForEvaluation = async (req, res) => {
  try {
    const exam = await findExamAndCheckAccess(req, res);
    if (!exam) return;

    if (!mongoose.Types.ObjectId.isValid(req.params.attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      examId: exam._id,
      status: {
        $in: ["submitted", "auto-submitted", "evaluated"],
      },
    }).populate("studentId", "name email");

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Submitted attempt not found.",
      });
    }

    const questions = await Question.find({
      examId: exam._id,
    }).sort({ order: 1 });

    const answerMap = new Map(
      attempt.answers.map((answer) => [
        String(answer.questionId),
        answer,
      ])
    );

    const review = questions.map((question) => {
      const answer = answerMap.get(String(question._id));

      return {
        questionId: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
        correctAnswer: question.correctAnswer,
        marks: question.marks,
        studentAnswer: answer?.answer || "",
        marksAwarded: answer?.marksAwarded ?? 0,
        isEvaluated: answer?.isEvaluated ?? false,
        feedback: answer?.feedback || "",
      };
    });

    return res.status(200).json({
      success: true,
      attempt: {
        id: attempt._id,
        student: attempt.studentId,
        submittedAt: attempt.submittedAt,
        status: attempt.status,
        resultPublished: attempt.resultPublished,
      },
      questions: review,
    });
  } catch (error) {
    console.error("Get evaluation attempt error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch attempt for evaluation.",
    });
  }
};

// EVALUATE DESCRIPTIVE ANSWERS
export const evaluateAttempt = async (req, res) => {
  try {
    const exam = await findExamAndCheckAccess(req, res);
    if (!exam) return;

    const { evaluations } = req.body;

    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one answer evaluation.",
      });
    }

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      examId: exam._id,
      status: {
        $in: ["submitted", "auto-submitted", "evaluated"],
      },
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Submitted attempt not found.",
      });
    }

    if (attempt.resultPublished) {
      return res.status(400).json({
        success: false,
        message: "Published results cannot be changed.",
      });
    }

    const questions = await Question.find({
      examId: exam._id,
    });

    const questionMap = new Map(
      questions.map((question) => [
        String(question._id),
        question,
      ])
    );

    const answerMap = new Map(
      attempt.answers.map((answer) => [
        String(answer.questionId),
        answer,
      ])
    );

    for (const item of evaluations) {
      if (
        !item ||
        !mongoose.Types.ObjectId.isValid(item.questionId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid question ID in evaluation.",
        });
      }

      const question = questionMap.get(String(item.questionId));
      const answer = answerMap.get(String(item.questionId));

      if (!question || question.questionType !== "descriptive") {
        return res.status(400).json({
          success: false,
          message: "Only descriptive questions can be manually evaluated.",
        });
      }

      if (!answer) {
        return res.status(400).json({
          success: false,
          message: "The student has no saved answer for this question.",
        });
      }

      if (
        typeof item.marksAwarded !== "number" ||
        !Number.isFinite(item.marksAwarded) ||
        item.marksAwarded < 0 ||
        item.marksAwarded > question.marks
      ) {
        return res.status(400).json({
          success: false,
          message: `Marks must be between 0 and ${question.marks}.`,
        });
      }

      if (
        item.feedback !== undefined &&
        typeof item.feedback !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Feedback must be text.",
        });
      }
    }

    for (const item of evaluations) {
      const answer = answerMap.get(String(item.questionId));

      answer.marksAwarded = item.marksAwarded;
      answer.feedback = item.feedback || "";
      answer.isEvaluated = true;
    }

    // Recalculate all marks from the server-side question key.
    let obtainedMarks = 0;
    let pendingEvaluation = false;

    for (const question of questions) {
      const answer = answerMap.get(String(question._id));

      if (question.questionType === "mcq") {
        const selected = String(answer?.answer || "").trim();
        const correct = String(question.correctAnswer || "").trim();

        if (selected && selected === correct) {
          answer.marksAwarded = question.marks;
        } else if (selected && exam.negativeMarking) {
          answer.marksAwarded = -(
            question.negativeMarks || exam.negativeMarks || 0
          );
        } else {
          answer.marksAwarded = 0;
        }

        answer.isEvaluated = true;
      } else if (!answer?.isEvaluated) {
        pendingEvaluation = true;
      }

      if (answer?.isEvaluated) {
        obtainedMarks += answer.marksAwarded;
      }
    }

    attempt.obtainedMarks = Math.max(0, obtainedMarks);
    attempt.totalMarks = exam.totalMarks;
    attempt.percentage = exam.totalMarks > 0
      ? Number(
          (
            (attempt.obtainedMarks / exam.totalMarks) * 100
          ).toFixed(2)
        )
      : 0;

    attempt.status = pendingEvaluation
      ? attempt.status
      : "evaluated";

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: pendingEvaluation
        ? "Evaluation saved. Some descriptive answers are still pending."
        : "All answers have been evaluated.",
      evaluation: {
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        pendingEvaluation,
      },
    });
  } catch (error) {
    console.error("Evaluate attempt error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to evaluate answers.",
    });
  }
};

// PUBLISH RESULT TO STUDENT
export const publishAttemptResult = async (req, res) => {
  try {
    const exam = await findExamAndCheckAccess(req, res);
    if (!exam) return;

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      examId: exam._id,
      status: {
        $in: ["submitted", "auto-submitted", "evaluated"],
      },
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Submitted attempt not found.",
      });
    }

    const questions = await Question.find({
      examId: exam._id,
    }).select("_id questionType");

    const answerMap = new Map(
      attempt.answers.map((answer) => [
        String(answer.questionId),
        answer,
      ])
    );

    const pending = questions.some((question) => {
      if (question.questionType !== "descriptive") return false;

      const answer = answerMap.get(String(question._id));
      return !answer?.isEvaluated;
    });

    if (pending) {
      return res.status(400).json({
        success: false,
        message: "Evaluate all descriptive answers before publishing.",
      });
    }

    attempt.resultPublished = true;
    attempt.status = "evaluated";

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: "Result published successfully.",
      result: {
        obtainedMarks: attempt.obtainedMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        passed: attempt.obtainedMarks >= exam.passingMarks,
      },
    });
  } catch (error) {
    console.error("Publish result error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to publish result.",
    });
  }
};

// VIEW PUBLISHED RESULTS FOR AN EXAM
export const getExamResults = async (req, res) => {
  try {
    const exam = await findExamAndCheckAccess(req, res);
    if (!exam) return;

    const attempts = await ExamAttempt.find({
      examId: exam._id,
      resultPublished: true,
    })
      .populate("studentId", "name email")
      .select("studentId obtainedMarks totalMarks percentage submittedAt")
      .sort({ obtainedMarks: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: attempts.length,
      results: attempts.map((attempt) => ({
        ...attempt,
        passed: attempt.obtainedMarks >= exam.passingMarks,
      })),
    });
  } catch (error) {
    console.error("Exam results error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch exam results.",
    });
  }
};
