const express = require('express');
const router = express.Router();
const {
  createQuiz,
  getQuizById,
  startQuiz,
  updateQuiz,
  submitQuiz,
  getQuizAttempts,
  logSecurityEvent
} = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/', authorizeRoles('Instructor', 'Admin'), createQuiz);
router.route('/:id')
  .get(getQuizById)
  .put(authorizeRoles('Instructor', 'Admin'), updateQuiz);

router.post('/:id/start', authorizeRoles('Employee'), startQuiz);
router.post('/:id/submit', authorizeRoles('Employee'), submitQuiz);
router.post('/:id/security-event', authorizeRoles('Employee'), logSecurityEvent);
router.get('/:id/attempts', getQuizAttempts);

module.exports = router;
