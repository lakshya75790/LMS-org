const express = require('express');
const router = express.Router();
const {
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  createInstructor,
  getInstructors,
  createAdmin,
  getEmployees,
  updateProfile,
  updateUserStatus
} = require('../controllers/orgController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(protect);

// Department Routes
router.route('/departments')
  .get(cacheMiddleware(), getDepartments)
  .post(authorizeRoles('Admin'), createDepartment);

router.route('/departments/:id')
  .put(authorizeRoles('Admin'), updateDepartment)
  .delete(authorizeRoles('Admin'), deleteDepartment);

// User Management Routes
router.route('/instructors')
  .get(authorizeRoles('Admin'), cacheMiddleware(), getInstructors)
  .post(authorizeRoles('Admin'), createInstructor);

router.post('/admins', authorizeRoles('Admin'), createAdmin);
router.get('/employees', authorizeRoles('Admin'), cacheMiddleware(), getEmployees);
router.put('/profile', updateProfile);

// User Activation / Deactivation Route
router.put('/users/:id/status', authorizeRoles('Admin'), updateUserStatus);

module.exports = router;
