const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeMultipartRequest({ path, headers = {}, fieldName = 'file', fileName, fileBuffer, mimeType, port = 5029 }) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n`;
    body += `Content-Type: ${mimeType}\r\n\r\n`;
    
    const headerBuffer = Buffer.from(body, 'utf-8');
    const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    
    const payload = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        ...headers
      }
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
        resolve({ statusCode: res.statusCode, body: json });
      });
    });

    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

function makeJsonRequest({ method, path, headers = {}, body = null, port = 5029 }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runMediaE2ETest() {
  console.log('🚀 Running E2E Verification for Cloudinary Media Upload & Employee Video Playback Pipeline...\n');

  await connectDB();

  const server = app.listen(5029, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `media_admin_${ts}@test.com`;
      const instEmail = `media_inst_${ts}@test.com`;
      const empEmail = `media_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeJsonRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Media Test Org ${ts}`,
          orgCode: `MTO${ts.toString().slice(-4)}`,
          adminName: 'Media Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Register Instructor & Employee
      console.log('\n2. Registering Instructor & Employee...');
      const catRes = await makeJsonRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Technical Training' }
      });
      const catId = catRes.body.data.category._id;

      await makeJsonRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Media Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeJsonRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'Password123' } });
      const instCookie = instLogin.cookie;

      const eReg = await makeJsonRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Test Employee', email: empEmail, password: 'Password123', orgCode } });
      const empId = eReg.body.data.user._id;
      const empLogin = await makeJsonRequest({ method: 'POST', path: '/api/auth/login', body: { email: empEmail, password: 'Password123' } });
      const empCookie = empLogin.cookie;

      // 3. Test Image Upload to Cloudinary
      console.log('\n3. Testing Media Image Upload Endpoint to Cloudinary...');
      const samplePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const imgUploadRes = await makeMultipartRequest({
        path: '/api/media/upload-image',
        headers: { Cookie: instCookie },
        fieldName: 'file',
        fileName: 'test_thumb.png',
        fileBuffer: samplePng,
        mimeType: 'image/png'
      });

      console.log('   Image Upload Status:', imgUploadRes.statusCode);
      console.log('   Image Upload Result URL:', imgUploadRes.body.data?.url);

      if (imgUploadRes.statusCode !== 200 || !imgUploadRes.body.data?.url) {
        throw new Error(`Image upload failed: ${JSON.stringify(imgUploadRes.body)}`);
      }

      // 4. Create Course with Uploaded Thumbnail & Real Cloudinary Video Reference
      console.log('\n4. Creating Course with real video media reference...');
      const videoMediaUrl = 'https://res.cloudinary.com/dejhhwfmj/video/upload/v1/samples/elephants.mp4';

      const courseRes = await makeJsonRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Full Stack Media & Video Architecture',
          description: 'Video streaming and playback training',
          categoryId: catId,
          thumbnailUrl: imgUploadRes.body.data.url,
          status: 'published',
          sections: [{
            title: 'Media Infrastructure',
            lectures: [
              { title: 'Lesson 1: Real-time Streaming', description: 'Video lesson', videoUrl: videoMediaUrl, videoDuration: 120 }
            ]
          }]
        }
      });

      const training = courseRes.body.data.training;
      console.log('   Training Created ID:', training._id);

      // 5. Assign to Employee & Verify Video Playback URL Delivery
      console.log('\n5. Assigning Training & Fetching Employee Progress Workspace...');
      await makeJsonRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: { assignmentType: 'specific', trainingId: training._id, employeeIds: [empId] }
      });

      const assignRes = await makeJsonRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: empCookie } });
      const trainingAssignmentId = assignRes.body.data.assignments[0]._id;

      const progRes = await makeJsonRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });

      const empSubSection = progRes.body.data.assignment.trainingId.sections[0].subSections[0];
      console.log('   Employee SubSection Video URL delivered:', empSubSection.videoUrl);

      if (!empSubSection.videoUrl || empSubSection.videoUrl !== videoMediaUrl) {
        throw new Error('Video URL delivery failed! Employee did not receive real video URL.');
      }

      console.log('\n🎉 CLOUDINARY MEDIA UPLOAD & EMPLOYEE VIDEO PLAYBACK PIPELINE VERIFIED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runMediaE2ETest();
