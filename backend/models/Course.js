import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department ID is required"],
    },

    name: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
    },

    code: {
      type: String,
      required: [true, "Course code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    durationYears: {
      type: Number,
      required: [true, "Course duration is required"],
      min: 1,
      max: 10,
    },

    description: {
      type: String,
      trim: true,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Course = mongoose.model("Course", courseSchema);

export default Course;