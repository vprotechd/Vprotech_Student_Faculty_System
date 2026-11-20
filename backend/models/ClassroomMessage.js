import mongoose from "mongoose";

const classroomMessageSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["student", "faculty"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true, versionKey: false }
);

classroomMessageSchema.index({ classroomId: 1, createdAt: -1 });

export default mongoose.model(
  "ClassroomMessage",
  classroomMessageSchema
);
