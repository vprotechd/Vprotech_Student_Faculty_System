
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    questionType: {
      type: String,
      enum: ['mcq', 'descriptive'],
      required: true,
    },

    options: [
      {
        optionText: {
          type: String,
          required: true,
        },
      },
    ],

    correctAnswer: {
      type: String,
      default: null,
    },

    marks: {
      type: Number,
      required: true,
      min: 0,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    explanation: {
      type: String,
      default: '',
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ examId: 1, order: 1 });

export default mongoose.model('Question', questionSchema);
