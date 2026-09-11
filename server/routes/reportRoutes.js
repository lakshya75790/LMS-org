const express = require('express');
const router = express.Router();
const {
  getFullOrgReport,
  getAdminDashboardReports,
  getEmployeeReport,
  getInstructorDashboardReports,
  getMyReport
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(protect);

router.get('/full-org-report', authorizeRoles('Admin'), cacheMiddleware(), getFullOrgReport);
router.get('/admin-dashboard', authorizeRoles('Admin'), cacheMiddleware(), getAdminDashboardReports);
router.get('/instructor-dashboard', authorizeRoles('Instructor'), cacheMiddleware(), getInstructorDashboardReports);
router.get('/employee/:employeeId', authorizeRoles('Admin', 'Instructor'), cacheMiddleware(), getEmployeeReport);
router.get('/my-report', authorizeRoles('Employee'), cacheMiddleware(), getMyReport);

module.exports = router;
