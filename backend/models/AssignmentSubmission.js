import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, default: "" },
  fileName: { type: String, required: true },
  mimeType: { type: String, default: "application/octet-stream" },
  resourceType: { type: String, default: "raw" },
  bytes: { type: Number, default: 0 },
}, { _id: false });

const assignmentSubmissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  file: { type: fileSchema, required: true },
  comment: { type: String, trim: true, maxlength: 3000, default: "" },
  status: { type: String, enum: ["submitted", "late", "graded"], default: "submitted", index: true },
  marks: { type: Number, min: 0, default: null },
  feedback: { type: String, trim: true, maxlength: 5000, default: "" },
  submittedAt: { type: Date, default: Date.now },
  gradedAt: { type: Date, default: null },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", default: null },
}, { timestamps: true });

assignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
export default mongoose.models.AssignmentSubmission || mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
