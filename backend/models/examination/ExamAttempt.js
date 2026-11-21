
import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    answer: {
      type: String,
      default: "",
    },
    marksAwarded: {
      type: Number,
      default: 0,
    },
    isEvaluated: {
      type: Boolean,
      default: false,
    },
    feedback: {
  type: String,
  default: "",
},
  },
  { _id: false }
);

const examAttemptSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: [
        "in-progress",
        "submitted",
        "evaluated",
        "auto-submitted",
      ],
      default: "in-progress",
    },
    obtainedMarks: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    resultPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One attempt per student per exam.
// Retakes will need a separate attempt-number design.
examAttemptSchema.index(
  { examId: 1, studentId: 1 },
  { unique: true }
);

const ExamAttempt = mongoose.model(
  "ExamAttempt",
  examAttemptSchema
);

export default ExamAttempt;
