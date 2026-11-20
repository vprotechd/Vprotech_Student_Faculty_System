import mongoose from 'mongoose';

const lectureSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    course: {
      type: String,
      required: true,
      trim: true,
    },

    cohort: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
      trim: true,
    },

    endTime: {
      type: String,
      required: true,
      trim: true,
    },

    room: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        'Scheduled',
        'Live Soon',
        'Live',
        'Completed',
        'Cancelled',
      ],
      default: 'Scheduled',
    },

    meetingUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  'Lecture',
  lectureSchema
);