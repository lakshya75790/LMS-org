const mongoose = require('mongoose');

const trainingCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Training category name is required'],
      trim: true
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required']
    },
    description: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'deactivated'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate category name per organization
trainingCategorySchema.index({ name: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('TrainingCategory', trainingCategorySchema);
