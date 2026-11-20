import mongoose from "mongoose";

const classSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
  
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
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

    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    mode: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },

    meetingUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2048,
    },

    room: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "cancelled"],
      default: "scheduled",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

classSchema.pre("validate", function () {
  if (
    this.startAt &&
    this.endAt &&
    this.endAt <= this.startAt
  ) {
    this.invalidate("endAt", "Class end time must be later than start time.");
  }

  if (this.mode === "online" && !this.meetingUrl) {
    this.invalidate("meetingUrl", "An online class requires a meeting URL.");
  }
});

classSchema.index({ courseId: 1, semester: 1, section: 1, startAt: 1 });
classSchema.index({ facultyId: 1, startAt: 1 });
classSchema.index({ status: 1, startAt: 1 });

const ClassModel = mongoose.model("Class", classSchema);

export default ClassModel;