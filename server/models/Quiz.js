const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  options: [
    {
      type: String,
      required: true,
      trim: true
    }
  ],
  correctAnswerIndex: {
    type: Number,
    required: [true, 'Correct answer index is required']
  },
  score: {
    type: Number,
    default: 1
  }
});

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Training',
      required: [true, 'Training ID is required']
    },
    subSectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'SubSection ID is required']
    },
    questions: [questionSchema],
    timeLimitMinutes: {
      type: Number,
      default: 15
    },
    passingScorePercent: {
      type: Number,
      default: 70
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Instructor ID is required']
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Quiz', quizSchema);
