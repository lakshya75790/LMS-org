const express = require('express');
const router = express.Router();
const {
  createAssignment,
  getAssignmentById,
  updateAssignment,
  submitAssignment,
  getAssignmentSubmissions,
  getInstructorSubmissions,
  getEmployeeFeedback,
  reviewSubmission
} = require('../controllers/assignmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/', authorizeRoles('Instructor', 'Admin'), createAssignment);
router.get('/instructor-submissions', authorizeRoles('Instructor', 'Admin'), getInstructorSubmissions);
router.get('/my-feedback', authorizeRoles('Employee'), getEmployeeFeedback);

router.route('/:id')
  .get(getAssignmentById)
  .put(authorizeRoles('Instructor', 'Admin'), updateAssignment);

router.post('/:id/submit', authorizeRoles('Employee'), submitAssignment);
router.get('/:id/submissions', authorizeRoles('Instructor', 'Admin'), getAssignmentSubmissions);
router.put('/submissions/:submissionId/review', authorizeRoles('Instructor', 'Admin'), reviewSubmission);

module.exports = router;
