const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment ID is required']
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
    submissionType: {
      type: String,
      enum: ['github', 'file'],
      required: [true, 'Submission type is required']
    },
    githubUrl: {
      type: String,
      trim: true
    },
    fileUrl: {
      type: String,
      trim: true
    },
    filePublicId: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['submitted', 'reviewed'],
      default: 'submitted'
    },
    grade: {
      type: String,
      enum: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Poor'],
      default: null
    },
    score: {
      type: Number,
      default: 0
    },
    feedback: {
      type: String,
      trim: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
