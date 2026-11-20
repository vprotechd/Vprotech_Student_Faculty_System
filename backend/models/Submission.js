import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },

    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    fileUrl: {
      type: String,
      required: true,
    },

    filePublicId: {
      type: String,
      default: '',
    },

    fileName: {
      type: String,
      default: '',
    },

    fileType: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: [
        'pending',
        'reviewed',
        'graded',
        'rejected',
      ],
      default: 'pending',
    },

    marks: {
      type: Number,
      min: 0,
      default: null,
    },

    maxMarks: {
      type: Number,
      min: 0,
      default: 100,
    },

    feedback: {
      type: String,
      trim: true,
      default: '',
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    gradedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Submission = mongoose.model(
  'Submission',
  submissionSchema
);

export default Submission;