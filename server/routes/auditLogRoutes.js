const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLogController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.use(protect);

router.get('/', authorizeRoles('Admin'), cacheMiddleware(), getAuditLogs);

module.exports = router;
