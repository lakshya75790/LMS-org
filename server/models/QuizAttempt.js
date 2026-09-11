const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz ID is required']
    },
    trainingAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingAssignment',
      default: null
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee ID is required']
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'completed'
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date,
      default: null
    },
    answers: [
      {
        questionIndex: Number,
        questionText: String,
        selectedOptionIndex: Number, // null/undefined if unanswered
        selectedAnswerText: String,
        correctAnswerIndex: Number,
        correctAnswerText: String,
        options: [String],
        isCorrect: Boolean
      }
    ],
    totalScore: {
      type: Number,
      default: 0
    },
    maxScore: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    passed: {
      type: Boolean,
      default: false
    },
    attemptNumber: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
