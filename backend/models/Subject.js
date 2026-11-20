import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },

    facultyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Faculty",
      },
    ],

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

subjectSchema.index(
  { courseId: 1, semester: 1, code: 1 },
  { unique: true }
);

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;