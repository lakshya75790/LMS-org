const dotenv = require('dotenv');
dotenv.config();

const https = require('https');
const dns = require('dns');
const { getCloudinary } = require('./config/cloudinary');

console.log('--- 1. Testing DNS Lookup for api.cloudinary.com ---');
dns.lookup('api.cloudinary.com', { all: true }, (err, addresses) => {
  if (err) {
    console.error('DNS Lookup Error:', err);
  } else {
    console.log('DNS Lookup Addresses:', addresses);
  }
});

console.log('\n--- 2. Testing HTTPS Connection to Cloudinary ---');
const req = https.get('https://api.cloudinary.com/v1_1/dejhhwfmj/ping', (res) => {
  console.log('HTTPS Status Code:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('HTTPS Response:', data));
});
req.on('error', (err) => console.error('HTTPS Connection Error:', err));
req.setTimeout(10000, () => {
  console.error('HTTPS Connection Timed Out!');
  req.destroy();
});

console.log('\n--- 3. Testing Cloudinary SDK with secure: true & timeout: 30000 ---');
const cloudinaryInstance = getCloudinary();
cloudinaryInstance.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 30000
});

const sampleBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

const start = Date.now();
const uploadStream = cloudinaryInstance.uploader.upload_stream(
  {
    folder: 'test',
    resource_type: 'image'
  },
  (err, res) => {
    if (err) {
      console.error(`SDK Upload Error in ${Date.now() - start}ms:`, err);
    } else {
      console.log(`SDK Upload Success in ${Date.now() - start}ms! URL:`, res.secure_url);
    }
  }
);
uploadStream.end(sampleBuffer);
