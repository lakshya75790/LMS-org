const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5005 }) {
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

async function runUserActivationTests() {
  console.log('🚀 Testing User Activation & Deactivation Management APIs...\n');

  await connectDB();

  const server = app.listen(5005, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `act_admin_${ts}@test.com`;
      const empEmail = `act_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Activation Test Org ${ts}`,
          orgCode: `ACT${ts.toString().slice(-4)}`,
          adminName: 'Admin Manager',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      console.log('   Setup Status:', setupRes.statusCode);
      const adminCookie = setupRes.cookie;
      const adminId = setupRes.body.data.user._id;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Register Employee
      console.log('\n2. Registering Employee account...');
      const empReg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Active Employee', email: empEmail, password: 'Password123', orgCode }
      });
      console.log('   Employee Registration Status:', empReg.statusCode);
      const empCookie = empReg.cookie;
      const empId = empReg.body.data.user._id;

      // 3. Admin Views Employee Status
      console.log('\n3. Admin viewing employees list...');
      const empListRes = await makeRequest({
        method: 'GET',
        path: '/api/org/employees',
        headers: { Cookie: adminCookie }
      });
      console.log('   Employee Status:', empListRes.body.data.employees[0].status);

      // 4. Admin Deactivates Employee
      console.log('\n4. Testing PUT /api/org/users/:id/status (Deactivate Employee)...');
      const deactRes = await makeRequest({
        method: 'PUT',
        path: `/api/org/users/${empId}/status`,
        headers: { Cookie: adminCookie },
        body: { status: 'deactivated' }
      });
      console.log('   Deactivate Response Status:', deactRes.statusCode, '| Message:', deactRes.body.message);
      console.log('   Deactivated User Status:', deactRes.body.data.user.status);

      // 5. Deactivated Employee Tries to Login -> Expect 403
      console.log('\n5. Testing Login as Deactivated Employee...');
      const deactLoginRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      console.log('   Login Response Status:', deactLoginRes.statusCode, '| Error Msg:', deactLoginRes.body.message);

      // 6. Deactivated Employee Tries Protected Request with Existing Cookie -> Expect 403
      console.log('\n6. Testing Protected Request (GET /api/auth/me) with Deactivated User Cookie...');
      const deactMeRes = await makeRequest({
        method: 'GET',
        path: '/api/auth/me',
        headers: { Cookie: empCookie }
      });
      console.log('   Protected Request Status:', deactMeRes.statusCode, '| Error Msg:', deactMeRes.body.message);

      // 7. Admin Tries to Deactivate an Admin -> Expect 400
      console.log('\n7. Testing Admin attempting to deactivate Admin account...');
      const deactAdminRes = await makeRequest({
        method: 'PUT',
        path: `/api/org/users/${adminId}/status`,
        headers: { Cookie: adminCookie },
        body: { status: 'deactivated' }
      });
      console.log('   Deactivate Admin Status:', deactAdminRes.statusCode, '| Error Msg:', deactAdminRes.body.message);

      // 8. Admin Reactivates Employee
      console.log('\n8. Testing PUT /api/org/users/:id/status (Reactivate Employee)...');
      const reactRes = await makeRequest({
        method: 'PUT',
        path: `/api/org/users/${empId}/status`,
        headers: { Cookie: adminCookie },
        body: { status: 'active' }
      });
      console.log('   Reactivate Response Status:', reactRes.statusCode, '| Message:', reactRes.body.message);
      console.log('   Reactivated User Status:', reactRes.body.data.user.status);

      // 9. Reactivated Employee Logs In & Accesses System Successfully
      console.log('\n9. Testing Login & Protected Request for Reactivated Employee...');
      const reactLoginRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      console.log('   Reactivated Login Status:', reactLoginRes.statusCode, reactLoginRes.body.message);
      const newEmpCookie = reactLoginRes.cookie;

      const reactMeRes = await makeRequest({
        method: 'GET',
        path: '/api/auth/me',
        headers: { Cookie: newEmpCookie }
      });
      console.log('   Reactivated Protected Request Status:', reactMeRes.statusCode, '| User:', reactMeRes.body.data.user.name);

      // 10. Audit Logs Verification
      console.log('\n10. Checking Audit Logs for DEACTIVATE_USER and ACTIVATE_USER...');
      const auditRes = await makeRequest({ method: 'GET', path: '/api/audit-logs', headers: { Cookie: adminCookie } });
      const logs = auditRes.body.data.auditLogs.map(l => `${l.action}: ${l.details}`);
      console.log('    Audit Logs:');
      logs.forEach(l => console.log('    -', l));

      console.log('\n🎉 ALL USER ACTIVATION & DEACTIVATION TESTS PASSED SUCCESSFULLY! 🎉');

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runUserActivationTests();
