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

router.use(protect);

// Employee route
router.get('/my-certificates', authorizeRoles('Employee'), getMyCertificates);

// Instructor route
router.get('/instructor-certificates', authorizeRoles('Instructor'), getInstructorCertificates);

// Admin routes
router.get('/org-certificates', authorizeRoles('Admin', 'SuperAdmin'), getOrgCertificates);
router.get('/template', authorizeRoles('Admin', 'SuperAdmin'), getTemplateSettings);
router.put('/template', authorizeRoles('Admin', 'SuperAdmin'), updateTemplateSettings);
router.post('/template/reset', authorizeRoles('Admin', 'SuperAdmin'), resetTemplateSettings);
router.get('/backfill-eligible', authorizeRoles('Admin', 'SuperAdmin'), getBackfillEligible);
router.post('/backfill', authorizeRoles('Admin', 'SuperAdmin'), backfillCertificates);

// Single Certificate Route (Access control evaluated inside controller based on role)
router.get('/:id', getCertificateById);

module.exports = router;
