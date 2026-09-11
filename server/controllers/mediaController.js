const { getCloudinary } = require('../config/cloudinary');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Perform direct Cloudinary upload with proper resource-type timeouts
 */
const uploadToCloudinary = (file, folder, resourceType = 'auto') => {
  if (!file || !file.buffer) {
    return Promise.reject(new ApiError(400, 'File content is missing'));
  }

  return new Promise((resolve, reject) => {
    try {
      const cloudinaryInstance = getCloudinary();
      const options = {
        folder: `org_lms/${folder}`,
        resource_type: resourceType
      };

      // Set generous timeout based on resource type
      if (resourceType === 'video') {
        options.timeout = 120000; // 120 seconds (2 minutes) for videos
      } else {
        options.timeout = 30000; // 30 seconds for images & raw files
      }

      const uploadStream = cloudinaryInstance.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            console.error(`[MediaUpload Error] Folder: ${folder}, ResourceType: ${resourceType}:`, error.message || error);
            return reject(new ApiError(500, `Media upload to Cloudinary failed: ${error.message || 'Cloudinary network error'}`));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            duration: result.duration || 0
          });
        }
      );

      uploadStream.end(file.buffer);
    } catch (err) {
      console.error(`[MediaUpload Exception] Folder: ${folder}:`, err.message);
      reject(new ApiError(err.statusCode || 500, err.message || 'Cloudinary upload initialization failed'));
    }
  });
};

/**
 * @desc    Upload Image (Thumbnails, avatars)
 * @route   POST /api/media/upload-image
 * @access  Private (Instructor, Admin)
 */
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please select an image file to upload');
    }

    const result = await uploadToCloudinary(req.file, 'thumbnails', 'image');

    res.status(200).json(
      new ApiResponse(
        200,
        {
          url: result.url,
          publicId: result.publicId
        },
        'Image uploaded successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload Video Lecture
 * @route   POST /api/media/upload-video
 * @access  Private (Instructor, Admin)
 */
const uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please select a video file to upload');
    }

    const result = await uploadToCloudinary(req.file, 'videos', 'video');

    res.status(200).json(
      new ApiResponse(
        200,
        {
          url: result.url,
          publicId: result.publicId,
          duration: result.duration || 0
        },
        'Video uploaded successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload PDF / Document Resource
 * @route   POST /api/media/upload-pdf
 * @access  Private (Instructor, Admin, Employee)
 */
const uploadPdf = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please select a document file to upload');
    }

    const result = await uploadToCloudinary(req.file, 'resources', 'raw');

    res.status(200).json(
      new ApiResponse(
        200,
        {
          url: result.url,
          publicId: result.publicId,
          originalName: req.file.originalname
        },
        'Document uploaded successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Media Asset
 * @route   POST /api/media/delete
 * @access  Private (Instructor, Admin)
 */
const deleteMedia = async (req, res, next) => {
  try {
    const { publicId, resourceType } = req.body;

    if (!publicId) {
      throw new ApiError(400, 'publicId is required');
    }

    try {
      const cloudinaryInstance = getCloudinary();
      await cloudinaryInstance.uploader.destroy(publicId, { resource_type: resourceType || 'image' });
    } catch (err) {
      console.warn('[MediaDelete] Cloudinary destroy warning:', err.message);
    }

    res.status(200).json(new ApiResponse(200, {}, 'Media asset deleted successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadImage,
  uploadVideo,
  uploadPdf,
  deleteMedia
};
