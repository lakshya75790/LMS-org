
const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const {
  uploadImage,
  uploadVideo,
  uploadPdf,
  deleteMedia
} = require('../controllers/mediaController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/upload-image', authorizeRoles('Instructor', 'Admin'), upload.single('file'), uploadImage);
router.post('/upload-video', authorizeRoles('Instructor', 'Admin'), upload.single('file'), uploadVideo);
router.post('/upload-pdf', upload.single('file'), uploadPdf);
router.post('/delete', authorizeRoles('Instructor', 'Admin'), deleteMedia);

module.exports = router;
