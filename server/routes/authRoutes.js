const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const {
  setupOrganization,
  registerEmployee,
  login,
  logout,
  getMe,
  updateMyProfile,
  changePassword,
  updateProfilePicture,
  resetProfilePicture,
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPasswordWithOTP
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.post('/register-employee', registerEmployee);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', requestPasswordResetOTP);
router.post('/verify-otp', verifyPasswordResetOTP);
router.post('/reset-password', resetPasswordWithOTP);

router.use(protect);
router.post('/setup-org', authorizeRoles('SuperAdmin'), setupOrganization);
router.get('/me', cacheMiddleware(), getMe);
router.put('/profile', updateMyProfile);
router.put('/change-password', changePassword);
router.put('/profile-picture', upload.single('file'), updateProfilePicture);
router.delete('/profile-picture', resetProfilePicture);

module.exports = router;
