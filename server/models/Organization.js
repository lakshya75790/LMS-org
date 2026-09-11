const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Auto-generate org code from name if not provided
organizationSchema.pre('save', function (next) {
  if (!this.code && this.name) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const cleanName = this.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    this.code = `${cleanName}-${randomSuffix}`;
  }
  next();
});

module.exports = mongoose.model('Organization', organizationSchema);
