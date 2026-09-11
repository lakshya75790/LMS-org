const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5012 }) {
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

async function runInstructorDashboardTest() {
  console.log('🚀 Running E2E Verification for Instructor Studio Dashboard...\n');

  await connectDB();

  const server = app.listen(5012, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `inst_admin_${ts}@test.com`;
      const instEmail1 = `inst1_${ts}@test.com`;
      const instEmail2 = `inst2_${ts}@test.com`;
      const empEmail = `inst_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Instructor Test Org ${ts}`,
          orgCode: `ITO${ts.toString().slice(-4)}`,
          adminName: 'Instructor Test Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Create Category & Instructors
      console.log('\n2. Creating Category & Instructors 1 & 2 via POST /api/org/instructors...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Full Stack Web Dev' }
      });
      const catId = catRes.body.data.category._id;

      // Register Instructor 1 & Login
      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Instructor One', email: instEmail1, password: 'Password123' }
      });

      const inst1Login = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail1, password: 'Password123' }
      });
      const inst1Cookie = inst1Login.cookie;
      console.log('   Instructor 1 Login status:', inst1Login.statusCode, 'Cookie present:', Boolean(inst1Cookie));

      // Register Instructor 2 & Login
      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Instructor Two', email: instEmail2, password: 'Password123' }
      });

      const inst2Login = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail2, password: 'Password123' }
      });
      const inst2Cookie = inst2Login.cookie;

      // Register Employee
      const empReg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Employee Learner', email: empEmail, password: 'Password123', orgCode }
      });
      const empId = empReg.body.data.user._id;

      // 3. Login as Instructor 1 and Create Training Course
      console.log('\n3. Instructor 1 creating & publishing Training Course...');
      const trainRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings',
        headers: { Cookie: inst1Cookie },
        body: {
          title: 'React 19 & Next.js Masterclass',
          description: 'Frontend Web Engineering',
          categoryId: catId,
          durationDays: 14
        }
      });

      if (trainRes.statusCode !== 201) {
        console.error('Create Training Failed:', trainRes.statusCode, trainRes.body);
        throw new Error('Create Training failed');
      }

      const trainingId = trainRes.body.data.training._id;

      await makeRequest({
        method: 'PUT',
        path: `/api/trainings/${trainingId}`,
        headers: { Cookie: inst1Cookie },
        body: { isPublished: true, status: 'published' }
      });

      // Check Instructor 1 Dashboard Stats (createdTrainings should be 1)
      let d1 = await makeRequest({
        method: 'GET',
        path: '/api/reports/instructor-dashboard',
        headers: { Cookie: inst1Cookie }
      });
      console.log('   Instructor 1 Stats after Training Creation:', d1.body.data.stats);

      // 4. Admin assigns training to Employee
      console.log('\n4. Assigning Training to Employee...');
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: {
          assignmentType: 'specific',
          trainingId,
          employeeIds: [empId]
        }
      });

      d1 = await makeRequest({
        method: 'GET',
        path: '/api/reports/instructor-dashboard',
        headers: { Cookie: inst1Cookie }
      });
      console.log('   Instructor 1 Stats after Enrollment:', d1.body.data.stats);

      // 5. Security Isolation Check: Instructor 2 Dashboard must show 0 createdTrainings & 0 enrollments
      console.log('\n5. Checking Security Scoping (Instructor 2 Dashboard)...');
      const d2 = await makeRequest({
        method: 'GET',
        path: '/api/reports/instructor-dashboard',
        headers: { Cookie: inst2Cookie }
      });
      console.log('   Instructor 2 Stats (should be all 0):', d2.body.data.stats);

      if (
        d1.body.data.stats.createdTrainings === 1 &&
        d1.body.data.stats.totalEnrolled === 1 &&
        d2.body.data.stats.createdTrainings === 0 &&
        d2.body.data.stats.totalEnrolled === 0
      ) {
        console.log('\n🎉 INSTRUCTOR STUDIO DASHBOARD E2E TEST PASSED PERFECTLY! 🎉');
      } else {
        throw new Error('Instructor dashboard metrics or security scoping failed');
      }

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runInstructorDashboardTest();
