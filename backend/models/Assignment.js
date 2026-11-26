import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, default: "" },
  fileName: { type: String, required: true },
  mimeType: { type: String, default: "application/octet-stream" },
  resourceType: { type: String, default: "raw" },
  bytes: { type: Number, default: 0 },
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 10000 },
  instructions: { type: String, trim: true, default: "" },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null, index: true },
  semester: { type: Number, min: 1, max: 12, default: null },
  section: { type: String, trim: true, uppercase: true, default: null },
  dueDate: { type: Date, required: true, index: true },
  maxMarks: { type: Number, required: true, min: 1, max: 10000 },
  attachment: { type: attachmentSchema, default: null },
  status: { type: String, enum: ["draft", "published", "closed"], default: "draft", index: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

assignmentSchema.index({ course: 1, semester: 1, section: 1, status: 1, dueDate: 1 });
export default mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);
