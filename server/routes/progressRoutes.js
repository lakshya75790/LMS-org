const express = require('express');
const router = express.Router();
const {
  completeSubSection,
  getProgressByAssignment
} = require('../controllers/progressController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/complete-subsection', authorizeRoles('Employee'), completeSubSection);
router.get('/:trainingAssignmentId', getProgressByAssignment);

module.exports = router;
