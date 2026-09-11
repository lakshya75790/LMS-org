const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true
    },
    instructions: {
      type: String,
      required: [true, 'Assignment instructions are required'],
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
    maxScore: {
      type: Number,
      default: 100
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

module.exports = mongoose.model('Assignment', assignmentSchema);
