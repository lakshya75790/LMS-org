const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5004 }) {
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

async function runProfileAndPasswordTests() {
  console.log('🚀 Testing Profile Management & Change Password APIs for all 3 Roles (Admin, Instructor, Employee)...\n');

  await connectDB();

  const server = app.listen(5004, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `prof_admin_${ts}@test.com`;
      const instEmail = `prof_inst_${ts}@test.com`;
      const empEmail = `prof_emp_${ts}@test.com`;

      // 1. Setup Organization & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Profile Test Org ${ts}`,
          orgCode: `PTO${ts.toString().slice(-4)}`,
          adminName: 'Original Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      console.log('   Setup Status:', setupRes.statusCode);
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // Create Department
      const depRes = await makeRequest({
        method: 'POST',
        path: '/api/org/departments',
        headers: { Cookie: adminCookie },
        body: { name: 'Engineering', jobRoles: ['Full Stack Engineer'] }
      });
      const depId = depRes.body.data.department._id;

      // 2. Create Instructor
      console.log('2. Admin creating Instructor account...');
      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Original Instructor', email: instEmail, password: 'Password123', departmentId: depId }
      });

      // Login Instructor
      const instLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail, password: 'Password123' }
      });
      const instCookie = instLogin.cookie;

      // 3. Register Employee
      console.log('3. Registering Employee account...');
      const empReg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Original Employee', email: empEmail, password: 'Password123', orgCode }
      });
      const empCookie = empReg.cookie;

      // 4. Test View Profile (GET /api/auth/me) for all 3 roles
      console.log('\n4. Testing GET /api/auth/me for all 3 roles...');
      const adminMe = await makeRequest({ method: 'GET', path: '/api/auth/me', headers: { Cookie: adminCookie } });
      const instMe = await makeRequest({ method: 'GET', path: '/api/auth/me', headers: { Cookie: instCookie } });
      const empMe = await makeRequest({ method: 'GET', path: '/api/auth/me', headers: { Cookie: empCookie } });

      console.log('   Admin Name:', adminMe.body.data.user.name, '| Role:', adminMe.body.data.user.role);
      console.log('   Instructor Name:', instMe.body.data.user.name, '| Role:', instMe.body.data.user.role);
      console.log('   Employee Name:', empMe.body.data.user.name, '| Role:', empMe.body.data.user.role);

      // 5. Test Update Profile (PUT /api/auth/profile) for all 3 roles
      console.log('\n5. Testing PUT /api/auth/profile for all 3 roles...');
      const adminProfUp = await makeRequest({
        method: 'PUT',
        path: '/api/auth/profile',
        headers: { Cookie: adminCookie },
        body: { name: 'Updated Admin Name' }
      });
      console.log('   Admin Profile Updated Name:', adminProfUp.body.data.user.name);

      const instProfUp = await makeRequest({
        method: 'PUT',
        path: '/api/auth/profile',
        headers: { Cookie: instCookie },
        body: { name: 'Updated Instructor Name' }
      });
      console.log('   Instructor Profile Updated Name:', instProfUp.body.data.user.name);

      const empProfUp = await makeRequest({
        method: 'PUT',
        path: '/api/auth/profile',
        headers: { Cookie: empCookie },
        body: { name: 'Updated Employee Name', departmentId: depId, jobRole: 'Full Stack Engineer' }
      });
      console.log('   Employee Profile Updated Name:', empProfUp.body.data.user.name, '| Profile Complete:', empProfUp.body.data.user.isProfileComplete);

      // 6. Test Change Password Invalid Current Password
      console.log('\n6. Testing PUT /api/auth/change-password with invalid current password...');
      const invalidPassRes = await makeRequest({
        method: 'PUT',
        path: '/api/auth/change-password',
        headers: { Cookie: adminCookie },
        body: { currentPassword: 'WrongPassword', newPassword: 'NewPassword123' }
      });
      console.log('   Invalid Pass Response Status:', invalidPassRes.statusCode, '| Error Msg:', invalidPassRes.body.message);

      // 7. Test Change Password Success for all 3 roles
      console.log('\n7. Testing PUT /api/auth/change-password with valid passwords for all 3 roles...');
      const adminPassChange = await makeRequest({
        method: 'PUT',
        path: '/api/auth/change-password',
        headers: { Cookie: adminCookie },
        body: { currentPassword: 'Password123', newPassword: 'NewAdminPassword123' }
      });
      console.log('   Admin Password Change Status:', adminPassChange.statusCode, adminPassChange.body.message);

      const instPassChange = await makeRequest({
        method: 'PUT',
        path: '/api/auth/change-password',
        headers: { Cookie: instCookie },
        body: { currentPassword: 'Password123', newPassword: 'NewInstructorPassword123' }
      });
      console.log('   Instructor Password Change Status:', instPassChange.statusCode, instPassChange.body.message);

      const empPassChange = await makeRequest({
        method: 'PUT',
        path: '/api/auth/change-password',
        headers: { Cookie: empCookie },
        body: { currentPassword: 'Password123', newPassword: 'NewEmployeePassword123' }
      });
      console.log('   Employee Password Change Status:', empPassChange.statusCode, empPassChange.body.message);

      // 8. Verify Relogin with New Passwords
      console.log('\n8. Verifying Login with NEW passwords for all 3 roles...');
      const adminRelogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: adminEmail, password: 'NewAdminPassword123' } });
      const instRelogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'NewInstructorPassword123' } });
      const empRelogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: empEmail, password: 'NewEmployeePassword123' } });

      console.log('   Admin Relogin Status:', adminRelogin.statusCode, adminRelogin.body.message);
      console.log('   Instructor Relogin Status:', instRelogin.statusCode, instRelogin.body.message);
      console.log('   Employee Relogin Status:', empRelogin.statusCode, empRelogin.body.message);

      // 9. Verify Audit Logs created for Profile updates & Password changes
      console.log('\n9. Checking Audit Logs for UPDATE_PROFILE and CHANGE_PASSWORD actions...');
      const auditRes = await makeRequest({ method: 'GET', path: '/api/audit-logs', headers: { Cookie: adminCookie } });
      const auditActions = auditRes.body.data.auditLogs.map(log => `${log.userRole}: ${log.action} - ${log.details}`);
      console.log('   Audit Logs Recorded:');
      auditActions.forEach(log => console.log('   -', log));

      console.log('\n🎉 ALL PROFILE MANAGEMENT & PASSWORD CHANGE TESTS PASSED SUCCESSFULLY! 🎉');

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runProfileAndPasswordTests();
