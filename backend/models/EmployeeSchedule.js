import mongoose from "mongoose";

const employeeScheduleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      required: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
  },
  { timestamps: true, versionKey: false }
);

employeeScheduleSchema.pre("validate", function () {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    this.invalidate("endTime", "End time must be later than start time.");
  }
});

employeeScheduleSchema.index({ dayOfWeek: 1, startTime: 1 });

const EmployeeSchedule = mongoose.model("EmployeeSchedule", employeeScheduleSchema);

export default EmployeeSchedule;
