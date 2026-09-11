const mongoose = require('mongoose');

const extensionSchema = new mongoose.Schema({
  extendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  extendedTo: {
    type: Date,
    required: true
  },
  extendedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    trim: true
  }
});

const trainingAssignmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee ID is required']
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Training',
      required: [true, 'Training ID is required']
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null // null if auto-assigned by system
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required']
    },
    assignmentType: {
      type: String,
      enum: ['mandatory', 'dept_role', 'specific', 'auto'],
      required: [true, 'Assignment type is required']
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline date is required']
    },
    status: {
      type: String,
      enum: ['Assigned', 'In Progress', 'Completed', 'Overdue', 'Locked'],
      default: 'Assigned'
    },
    progressPercentage: {
      type: Number,
      default: 0
    },
    completedDate: {
      type: Date
    },
    overdueCount: {
      type: Number,
      default: 0
    },
    lockStatus: {
      isLocked: {
        type: Boolean,
        default: false
      },
      lockedAt: Date,
      unlockedAt: Date,
      lockedReason: String
    },
    extensionHistory: [extensionSchema]
  },
  {
    timestamps: true
  }
);

// Prevent duplicate assignment of the same training to the same employee
trainingAssignmentSchema.index({ employeeId: 1, trainingId: 1 }, { unique: true });

module.exports = mongoose.model('TrainingAssignment', trainingAssignmentSchema);
