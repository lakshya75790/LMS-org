const express = require('express');
const router = express.Router();
const {
  saveFullCourse,
  createTraining,
  getTrainings,
  getTrainingById,
  updateTraining,
  deleteTraining,
  addSection,
  updateSection,
  deleteSection,
  addSubSection,
  updateSubSection,
  deleteSubSection
} = require('../controllers/trainingController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(protect);

router.post('/save-full-course', authorizeRoles('Instructor', 'Admin'), saveFullCourse);

router.route('/')
  .get(cacheMiddleware(), getTrainings)
  .post(authorizeRoles('Instructor', 'Admin'), createTraining);

router.route('/:id')
  .get(cacheMiddleware(), getTrainingById)
  .put(authorizeRoles('Instructor', 'Admin'), updateTraining)
  .delete(authorizeRoles('Instructor', 'Admin'), deleteTraining);

// Section routes
router.post('/:id/sections', authorizeRoles('Instructor', 'Admin'), addSection);
router.route('/:id/sections/:sectionId')
  .put(authorizeRoles('Instructor', 'Admin'), updateSection)
  .delete(authorizeRoles('Instructor', 'Admin'), deleteSection);

// SubSection routes
router.post('/:id/sections/:sectionId/subsections', authorizeRoles('Instructor', 'Admin'), addSubSection);
router.route('/:id/sections/:sectionId/subsections/:subSectionId')
  .put(authorizeRoles('Instructor', 'Admin'), updateSubSection)
  .delete(authorizeRoles('Instructor', 'Admin'), deleteSubSection);

module.exports = router;
