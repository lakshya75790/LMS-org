const mongoose = require('mongoose');

const trainingProgressSchema = new mongoose.Schema(
  {
    trainingAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingAssignment',
      required: [true, 'Training Assignment ID is required'],
      unique: true
    },
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
    completedSubSectionIds: [
      {
        type: mongoose.Schema.Types.ObjectId
      }
    ],
    lastAccessedSubSectionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    progressPercentage: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('TrainingProgress', trainingProgressSchema);
