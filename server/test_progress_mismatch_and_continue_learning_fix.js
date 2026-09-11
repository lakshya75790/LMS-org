const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5030 }) {
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

async function runProgressMismatchE2ETest() {
  console.log('🚀 Running E2E Verification for Employee Progress Mismatch & Continue Learning Flow...\n');

  await connectDB();

  const server = app.listen(5030, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `pm_admin_${ts}@test.com`;
      const instEmail = `pm_inst_${ts}@test.com`;
      const empEmail = `pm_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Progress Mismatch Org ${ts}`,
          orgCode: `PMO${ts.toString().slice(-4)}`,
          adminName: 'PM Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Register Instructor & Employee
      console.log('\n2. Registering Instructor & Employee...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Workplace Skills' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Skills Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'Password123' } });
      const instCookie = instLogin.cookie;

      const eReg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Aman Kumar', email: empEmail, password: 'Password123', orgCode } });
      const empId = eReg.body.data.user._id;
      const empLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: empEmail, password: 'Password123' } });
      const empCookie = empLogin.cookie;

      // 3. Create Course with 2 Video Lessons + 1 Final Assessment Quiz (Total 3 required items)
      console.log('\n3. Creating Course with 2 Video Lessons + 1 Final Assessment Quiz (3 total items)...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Professional Communication & Workplace Skills',
          description: 'Master professional communication',
          categoryId: catId,
          status: 'published',
          sections: [{
            title: 'Effective Communication',
            lectures: [
              { title: 'Lesson 1: Verbal Communication', description: 'Verbal skills' },
              { title: 'Lesson 2: Non-Verbal & Listening Skills', description: 'Listening skills' }
            ],
            quiz: {
              title: 'Final Assessment Quiz',
              timeLimitMinutes: 15,
              passingScorePercent: 50,
              questions: [
                { questionText: 'Q1: What is active listening?', options: ['Listening attentively', 'Ignoring', 'Interrupting'], correctAnswerIndex: 0 }
              ]
            }
          }]
        }
      });

      const training = courseRes.body.data.training;
      const subSections = training.sections[0].subSections;

      let quizId = null;
      subSections.forEach(sub => {
        if (sub.quizId) quizId = sub.quizId._id || sub.quizId;
      });

      // Assign training to employee
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: { assignmentType: 'specific', trainingId: training._id, employeeIds: [empId] }
      });

      const assignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: empCookie } });
      const trainingAssignmentId = assignRes.body.data.assignments[0]._id;

      // 4. Test Scenario 1: Complete 1 / 3 Items (33%)
      console.log('\n4. Scenario 1: Employee completes 1 / 3 items (Lesson 1)...');
      const step1 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: subSections[0]._id }
      });
      console.log('   Progress after 1/3 items:', step1.body.data.percentage + '%', 'Status:', step1.body.data.assignmentStatus);
      if (step1.body.data.percentage !== 33) throw new Error(`Expected 33% after 1/3 items, got ${step1.body.data.percentage}%`);

      // 5. Test Scenario 2: Complete 2 / 3 Items (67%)
      console.log('\n5. Scenario 2: Employee completes 2 / 3 items (Lesson 2)...');
      const step2 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: subSections[1]._id }
      });
      console.log('   Progress after 2/3 items:', step2.body.data.percentage + '%', 'Status:', step2.body.data.assignmentStatus);
      if (step2.body.data.percentage !== 67) throw new Error(`Expected 67% after 2/3 items, got ${step2.body.data.percentage}%`);

      // 6. Test Scenario 3: Complete 3 / 3 Items (Pass Final Assessment Quiz with 100%)
      console.log('\n6. Scenario 3: Employee completes 3 / 3 items (Pass Final Assessment with 100%)...');
      const qStart = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/start`,
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId }
      });

      const qSub = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          trainingAssignmentId,
          attemptId: qStart.body.data.attempt._id,
          userAnswers: [{ questionIndex: 0, selectedOptionIndex: 0 }]
        }
      });
      console.log('   Quiz Submission Score:', qSub.body.data.percentage + '%', 'Passed?:', qSub.body.data.passed);

      // Verify GET /api/progress returns 100% Completed
      const progFinal = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });

      console.log('   Progress Percentage after 3/3 items:', progFinal.body.data.assignment.progressPercentage + '%');
      console.log('   Assignment Status:', progFinal.body.data.assignment.status);

      if (progFinal.body.data.assignment.progressPercentage !== 100 || progFinal.body.data.assignment.status !== 'Completed') {
        throw new Error(`Progress mismatch! Expected 100% Completed after 3/3 items, got ${progFinal.body.data.assignment.progressPercentage}% (${progFinal.body.data.assignment.status})`);
      }

      // 7. Verify My Assigned Trainings API
      console.log('\n7. Verifying My Assigned Trainings API returns 100% Completed...');
      const myAssignmentsCheck = await makeRequest({
        method: 'GET',
        path: '/api/assignments-engine/my-assignments',
        headers: { Cookie: empCookie }
      });
      const myAss = myAssignmentsCheck.body.data.assignments[0];
      console.log('   My Assignments Progress:', myAss.progressPercentage + '%', 'Status:', myAss.status);

      if (myAss.progressPercentage !== 100 || myAss.status !== 'Completed') {
        throw new Error('My Assigned Trainings API returned stale state!');
      }

      console.log('\n🎉 ALL PROGRESS MISMATCH & CONTINUE LEARNING E2E TEST SCENARIOS PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runProgressMismatchE2ETest();
