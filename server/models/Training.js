const mongoose = require('mongoose');

const pdfResourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  fileUrl: {
    type: String,
    required: true,
    trim: true
  },
  filePublicId: {
    type: String,
    trim: true
  }
});

const subSectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Sub-section title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 1
  },
  videoUrl: {
    type: String,
    trim: true
  },
  videoPublicId: {
    type: String,
    trim: true
  },
  videoDuration: {
    type: Number, // in seconds
    default: 0
  },
  pdfResources: [pdfResourceSchema],
  hasQuiz: {
    type: Boolean,
    default: false
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    default: null
  },
  hasAssignment: {
    type: Boolean,
    default: false
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    default: null
  }
});

const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Section title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 1
  },
  subSections: [subSectionSchema]
});

const trainingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Training title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Training description is required'],
      trim: true
    },
    benefits: [
      {
        type: String,
        trim: true
      }
    ],
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingCategory',
      required: [true, 'Category is required']
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
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
    },
    durationDays: {
      type: Number,
      required: [true, 'Duration in days is required'],
      default: 30
    },
    thumbnailUrl: {
      type: String,
      trim: true
    },
    thumbnailPublicId: {
      type: String,
      trim: true
    },
    sections: [sectionSchema],
    isMandatory: {
      type: Boolean,
      default: false
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Training', trainingSchema);
