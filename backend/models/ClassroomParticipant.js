import mongoose from "mongoose";

const classroomParticipantSchema = new mongoose.Schema(
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
    role: {
      type: String,
      enum: ["student", "faculty"],
      required: true,
    },
    agoraUid: {
      type: Number,
      required: true,
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

classroomParticipantSchema.index(
  { classroomId: 1, userId: 1 },
  { unique: true }
);
classroomParticipantSchema.index(
  { classroomId: 1, agoraUid: 1 },
  { unique: true }
);

export default mongoose.model(
  "ClassroomParticipant",
  classroomParticipantSchema
);
