require('dotenv').config();

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const imagePath = './test-image.jpg';

const timestamp = Math.floor(Date.now() / 1000);
const folder = 'org_lms/thumbnails';

// EXACT Cloudinary string to sign
const stringToSign = `folder=${folder}&timestamp=${timestamp}`;

const signature = crypto
  .createHash('sha1')
  .update(stringToSign + apiSecret)
  .digest('hex');

console.log('Cloud Name:', cloudName);
console.log('API Key:', apiKey ? 'Exists' : 'Missing');
console.log('API Secret:', apiSecret ? 'Exists' : 'Missing');
console.log('String to sign:', stringToSign);
console.log('Generated Signature:', signature);

const boundary = '----CloudinaryBoundary';

const fileBuffer = fs.readFileSync(imagePath);

const chunks = [];

function addField(name, value) {
  chunks.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    )
  );
}

addField('api_key', apiKey);
addField('timestamp', timestamp);
addField('folder', folder);
addField('signature', signature);

chunks.push(
  Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="test-image.jpg"\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`
  )
);

chunks.push(fileBuffer);

chunks.push(
  Buffer.from(`\r\n--${boundary}--\r\n`)
);

const body = Buffer.concat(chunks);

const options = {
  hostname: 'api.cloudinary.com',
  path: `/v1_1/${cloudName}/image/upload`,
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk.toString();
  });

  res.on('end', () => {
    console.log('\n==============================');
    console.log('HTTP STATUS:', res.statusCode);
    console.log('==============================');

    console.log('\nX-Cld-Error:');
    console.log(res.headers['x-cld-error']);

    console.log('\nAll Response Headers:');
    console.log(res.headers);

    console.log('\nResponse Body:');
    console.log(responseData);
  });
});

req.on('error', (error) => {
  console.error('\nRequest Error:');
  console.error(error);
});

req.write(body);
req.end();