
import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    className: {
      type: String,
      required: true,
      trim: true,
    },

    batch: {
      type: String,
      default: '',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    totalMarks: {
      type: Number,
      required: true,
      min: 1,
    },

    passingMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'completed', 'cancelled'],
      default: 'draft',
    },

    negativeMarking: {
      type: Boolean,
      default: false,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    shuffleQuestions: {
      type: Boolean,
      default: false,
    },

    showResultImmediately: {
      type: Boolean,
      default: false,
    },

    allowRetake: {
      type: Boolean,
      default: false,
    },

    instructions: {
      type: [String],
      default: [],
    },

    questionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

examSchema.index({ status: 1, startTime: 1 });
examSchema.index({ createdBy: 1 });

export default mongoose.model('Exam', examSchema);
