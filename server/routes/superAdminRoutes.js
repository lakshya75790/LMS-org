const express = require('express');
const router = express.Router();
const {
  createOrganization,
  getAllOrganizations,
  updateOrganization,
  toggleOrganizationStatus
} = require('../controllers/superAdminController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(protect);
router.use(authorizeRoles('SuperAdmin'));

router.route('/organizations')
  .post(createOrganization)
  .get(cacheMiddleware(5000), getAllOrganizations);

router.route('/organizations/:id')
  .put(updateOrganization);

router.route('/organizations/:id/status')
  .put(toggleOrganizationStatus);

module.exports = router;
