const express = require('express');
const router = express.Router();
const {
  assignTraining,
  createAutoRule,
  deactivateAutoRule,
  reactivateAutoRule,
  getAutoRules,
  getMyAssignments,
  getAllAssignments,
  extendDeadline,
  lockTraining,
  unlockTraining
} = require('../controllers/trainingAssignmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(protect);

// Auto-Assignment Rule Routes (Admin Only)
router.post('/auto-rule', authorizeRoles('Admin'), createAutoRule);
router.get('/auto-rules', authorizeRoles('Admin'), cacheMiddleware(), getAutoRules);
router.put('/auto-rules/:id/deactivate', authorizeRoles('Admin'), deactivateAutoRule);
router.put('/auto-rules/:id/reactivate', authorizeRoles('Admin'), reactivateAutoRule);

// Manual Targeted Assignment Route (Admin Only)
router.post('/assign', authorizeRoles('Admin'), assignTraining);

// Employee & All Assignments Routes
router.get('/my-assignments', authorizeRoles('Employee'), cacheMiddleware(), getMyAssignments);
router.get('/all', authorizeRoles('Admin', 'Instructor'), cacheMiddleware(), getAllAssignments);

router.put('/:assignmentId/extend-deadline', authorizeRoles('Instructor', 'Admin'), extendDeadline);
router.put('/:assignmentId/lock', authorizeRoles('Instructor', 'Admin'), lockTraining);
router.put('/:assignmentId/unlock', authorizeRoles('Instructor', 'Admin'), unlockTraining);

module.exports = router;
