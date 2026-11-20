import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
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

    dayOfWeek: {
      type: String,
      required: true,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
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

    meetingUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
      validate: {
        validator: (value) => !value || /^https?:\/\/\S+$/i.test(value),
        message: "Meeting link must start with http:// or https://",
      },
    },

    room: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
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

timetableSchema.pre("validate", function () {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    this.invalidate("endTime", "End time must be later than start time.");
  }
});

timetableSchema.index({
  courseId: 1,
  semester: 1,
  section: 1,
  dayOfWeek: 1,
});

const Timetable = mongoose.model("Timetable", timetableSchema);

export default Timetable;