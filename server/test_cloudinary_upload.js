const dotenv = require('dotenv');
dotenv.config();

const { getCloudinary } = require('./config/cloudinary');

async function testUpload() {
  console.log('Testing Cloudinary config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? 'PRESENT' : 'MISSING',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'PRESENT' : 'MISSING'
  });

  const cloudinaryInstance = getCloudinary();
  
  // Create a 1x1 transparent PNG buffer
  const sampleImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );

  console.log('Starting Cloudinary stream upload test...');
  const startTime = Date.now();

  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinaryInstance.uploader.upload_stream(
        {
          folder: 'org_lms/test',
          resource_type: 'image',
          timeout: 10000 // 10 sec timeout test
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(sampleImageBuffer);
    });

    console.log(`Cloudinary Upload SUCCESS in ${Date.now() - startTime}ms!`);
    console.log('URL:', result.secure_url);
    console.log('Public ID:', result.public_id);
  } catch (err) {
    console.error(`Cloudinary Upload FAILED in ${Date.now() - startTime}ms:`, err);
  }
}

testUpload();
