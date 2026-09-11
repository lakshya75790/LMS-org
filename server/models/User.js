const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const getDefaultDiceBearAvatar = (name) => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}`;
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: ['Admin', 'Instructor', 'Employee'],
      required: [true, 'Role is required']
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required']
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    jobRole: {
      type: String,
      trim: true,
      default: null
    },
    isProfileComplete: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['active', 'deactivated'],
      default: 'active'
    },
    profilePicture: {
      type: String,
      trim: true
    },
    profilePicturePublicId: {
      type: String,
      trim: true,
      default: null
    },
    isCustomAvatar: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: Set default avatar if not custom, and hash password
userSchema.pre('save', async function (next) {
  if (!this.profilePicture || (!this.isCustomAvatar && this.isModified('name'))) {
    this.profilePicture = getDefaultDiceBearAvatar(this.name);
  }

  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
