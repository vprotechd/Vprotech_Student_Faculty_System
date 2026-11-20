import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    repliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const doubtSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
      index: true,
    },

    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    replies: {
      type: [replySchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["pending", "answered", "closed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

doubtSchema.index({ studentId: 1, createdAt: -1 });
doubtSchema.index({ facultyId: 1, status: 1 });

const Doubt = mongoose.model("Doubt", doubtSchema);

export default Doubt;