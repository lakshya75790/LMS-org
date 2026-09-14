const express = require('express');
const router = express.Router();
const {
  getMyCertificates,
  getOrgCertificates,
  getInstructorCertificates,
  getCertificateById,
  getTemplateSettings,
  updateTemplateSettings,
  resetTemplateSettings,
  getBackfillEligible,
  backfillCertificates
} = require('../controllers/certificateController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(protect);

// Employee route
router.get('/my-certificates', authorizeRoles('Employee'), cacheMiddleware(), getMyCertificates);

// Instructor route
router.get('/instructor-certificates', authorizeRoles('Instructor'), cacheMiddleware(), getInstructorCertificates);

// Admin routes
router.get('/org-certificates', authorizeRoles('Admin', 'SuperAdmin'), cacheMiddleware(), getOrgCertificates);
router.get('/template', authorizeRoles('Admin', 'SuperAdmin'), cacheMiddleware(), getTemplateSettings);
router.put('/template', authorizeRoles('Admin', 'SuperAdmin'), updateTemplateSettings);
router.post('/template/reset', authorizeRoles('Admin', 'SuperAdmin'), resetTemplateSettings);
router.get('/backfill-eligible', authorizeRoles('Admin', 'SuperAdmin'), cacheMiddleware(), getBackfillEligible);
router.post('/backfill', authorizeRoles('Admin', 'SuperAdmin'), backfillCertificates);

// Single Certificate Route (Access control evaluated inside controller based on role)
router.get('/:id', getCertificateById);

module.exports = router;
