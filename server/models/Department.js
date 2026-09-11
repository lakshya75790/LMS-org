const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
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
    jobRoles: [
      {
        type: String,
        trim: true
      }
    ],
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

// Prevent duplicate department name in the same organization
departmentSchema.index({ name: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
