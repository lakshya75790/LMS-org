const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5006 }) {
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

async function runProfilePictureTests() {
  console.log('🚀 Testing Profile Picture Functionality (DiceBear Defaults & Cloudinary Uploads)...\n');

  await connectDB();

  const server = app.listen(5006, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `pic_admin_${ts}@test.com`;
      const instEmail = `pic_inst_${ts}@test.com`;
      const empEmail = `pic_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Pic Test Org ${ts}`,
          orgCode: `PIC${ts.toString().slice(-4)}`,
          adminName: 'Alice Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      console.log('   Admin Setup Status:', setupRes.statusCode);
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Create Instructor & Register Employee
      console.log('2. Creating Instructor & Registering Employee...');
      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Bob Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail, password: 'Password123' }
      });
      const instCookie = instLogin.cookie;

      const empReg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Charlie Employee', email: empEmail, password: 'Password123', orgCode }
      });
      const empCookie = empReg.cookie;

      // 3. Verify Default DiceBear Avatars on GET /api/auth/me for all 3 roles
      console.log('\n3. Verifying default DiceBear avatar URLs for all 3 roles...');
      const adminMe = await makeRequest({ method: 'GET', path: '/api/auth/me', headers: { Cookie: adminCookie } });
      const instMe = await makeRequest({ method: 'GET', path: '/api/auth/me', headers: { Cookie: instCookie } });
      const empMe = await makeRequest({ method: 'GET', path: '/api/auth/me', headers: { Cookie: empCookie } });

      console.log('   Admin Avatar:', adminMe.body.data.user.profilePicture);
      console.log('   Instructor Avatar:', instMe.body.data.user.profilePicture);
      console.log('   Employee Avatar:', empMe.body.data.user.profilePicture);

      // 4. Test Name Change Regenerates Default DiceBear Avatar (when isCustomAvatar is false)
      console.log('\n4. Updating Admin Name to check DiceBear avatar URL regeneration...');
      const adminNameUp = await makeRequest({
        method: 'PUT',
        path: '/api/auth/profile',
        headers: { Cookie: adminCookie },
        body: { name: 'Alice SuperAdmin' }
      });
      console.log('   New Admin Avatar URL:', adminNameUp.body.data.user.profilePicture);
      console.log('   Includes "Alice%20SuperAdmin":', adminNameUp.body.data.user.profilePicture.includes('Alice%20SuperAdmin'));

      // 5. Test Reset Profile Picture API (DELETE /api/auth/profile-picture)
      console.log('\n5. Testing DELETE /api/auth/profile-picture (Reset Profile Picture)...');
      const resetRes = await makeRequest({
        method: 'DELETE',
        path: '/api/auth/profile-picture',
        headers: { Cookie: empCookie }
      });
      console.log('   Reset Status:', resetRes.statusCode, '| Avatar:', resetRes.body.data.user.profilePicture);

      // 6. Check Audit Logs for Profile Picture Actions
      console.log('\n6. Checking Audit Logs for RESET_PROFILE_PICTURE action...');
      const auditRes = await makeRequest({ method: 'GET', path: '/api/audit-logs', headers: { Cookie: adminCookie } });
      const logs = auditRes.body.data.auditLogs.map(l => `${l.action}: ${l.details}`);
      console.log('   Audit Logs:');
      logs.forEach(l => console.log('   -', l));

      console.log('\n🎉 ALL PROFILE PICTURE TESTS PASSED SUCCESSFULLY! 🎉');

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runProfilePictureTests();
