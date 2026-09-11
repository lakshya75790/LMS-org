const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5024 }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = {};
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = { raw: data };
        }
        const setCookieHeader = res.headers['set-cookie'];
        let cookie = '';
        if (setCookieHeader && setCookieHeader.length > 0) {
          cookie = setCookieHeader[0].split(';')[0];
        }
        resolve({ statusCode: res.statusCode, cookie, body: json });
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

function createMultipartFormData(fileFieldName, fileName, mimeType, fileBuffer) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\n`;
  body += `Content-Type: ${mimeType}\r\n\r\n`;

  const payload = Buffer.concat([
    Buffer.from(body, 'utf8'),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  ]);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload
  };
}

async function runThumbnailUploadFixE2ETest() {
  console.log('🚀 Running E2E Verification for Thumbnail & Media Upload Fix...\n');

  await connectDB();

  const server = app.listen(5024, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `thumb_admin_${ts}@test.com`;
      const instEmail = `thumb_inst_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: `Upload Fix Org ${ts}`,
          orgCode: `UFO${ts.toString().slice(-4)}`,
          adminName: 'Upload Admin',
          adminEmail,
          adminPassword: 'Password123'
        })
      });
      const adminCookie = setupRes.cookie;

      // 2. Register Instructor
      console.log('\n2. Registering Instructor...');
      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Course Instructor', email: instEmail, password: 'Password123' })
      });

      const instLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: instEmail, password: 'Password123' })
      });
      const instCookie = instLogin.cookie;

      // 3. Test Thumbnail Upload (POST /api/media/upload-image)
      console.log('\n3. Testing Thumbnail Upload (POST /api/media/upload-image)...');
      const samplePngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );

      const formData = createMultipartFormData('file', 'training_thumbnail.png', 'image/png', samplePngBuffer);

      const startTime = Date.now();
      const uploadRes = await makeRequest({
        method: 'POST',
        path: '/api/media/upload-image',
        headers: {
          'Content-Type': formData.contentType,
          'Content-Length': formData.payload.length,
          Cookie: instCookie
        },
        body: formData.payload
      });

      const duration = Date.now() - startTime;
      console.log(`   Upload Status Code: ${uploadRes.statusCode} in ${duration}ms`);
      console.log('   Response Body:', uploadRes.body);

      if (uploadRes.statusCode !== 200 || !uploadRes.body?.data?.url) {
        throw new Error('Thumbnail upload failed!');
      }

      const imageUrl = uploadRes.body.data.url;
      console.log(`   Uploaded Image URL: ${imageUrl}`);

      // 4. Verify Static File Access
      if (imageUrl.startsWith('/uploads')) {
        console.log('\n4. Verifying Static File HTTP Access for Local Fallback...');
        const fetchFileRes = await makeRequest({
          method: 'GET',
          path: imageUrl
        });
        console.log(`   Static File Fetch Status: ${fetchFileRes.statusCode}`);
        if (fetchFileRes.statusCode !== 200) {
          throw new Error('Failed to retrieve uploaded static file over HTTP!');
        }
      }

      console.log('\n🎉 THUMBNAIL & MEDIA UPLOAD FIX E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runThumbnailUploadFixE2ETest();
