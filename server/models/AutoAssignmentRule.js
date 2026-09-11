const mongoose = require('mongoose');

const autoAssignmentRuleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Training',
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    customDeadlineDays: {
      type: Number,
      default: 30
    }
  },
  {
    timestamps: true
  }
);

// Unique index to prevent duplicate active rule per org & training
autoAssignmentRuleSchema.index({ organizationId: 1, trainingId: 1 }, { unique: true });

module.exports = mongoose.model('AutoAssignmentRule', autoAssignmentRuleSchema);
