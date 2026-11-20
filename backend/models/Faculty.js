import mongoose from "mongoose";

const facultySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },

    facultyId: {
      type: String,
      required: [true, "Faculty ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
    },

    qualification: {
      type: String,
      trim: true,
      default: null,
    },

    specialization: {
      type: String,
      trim: true,
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    profileImage: {
      type: String,
      default: null,
    },

    joiningDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Faculty = mongoose.model("Faculty", facultySchema);

export default Faculty;