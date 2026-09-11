const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5031 }) {
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

async function run4OutOf4E2ETest() {
  console.log('🚀 Running E2E Verification for 4/4 Completed = 100% Exact Ratio Progress Fix...\n');

  await connectDB();

  const server = app.listen(5031, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `ratio_admin_${ts}@test.com`;
      const instEmail = `ratio_inst_${ts}@test.com`;
      const empEmail = `ratio_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Ratio Test Org ${ts}`,
          orgCode: `RTO${ts.toString().slice(-4)}`,
          adminName: 'Ratio Admin',
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
        body: { name: 'Quality Assurance' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'QA Lead', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'Password123' } });
      const instCookie = instLogin.cookie;

      const eReg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Lakshya Joshi', email: empEmail, password: 'Password123', orgCode } });
      const empId = eReg.body.data.user._id;
      const empLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: empEmail, password: 'Password123' } });
      const empCookie = empLogin.cookie;

      // 3. Create Course with 3 Video Lessons + 1 Quiz (4 Total Items)
      console.log('\n3. Creating Course with 3 Video Lessons + 1 Quiz (4 Total Syllabus Items)...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Software Testing & Automation Principles',
          description: 'Quality assurance engineering',
          categoryId: catId,
          status: 'published',
          sections: [{
            title: 'Testing Fundamentals',
            lectures: [
              { title: 'Lesson 1: Unit Testing', description: 'Unit tests' },
              { title: 'Lesson 2: Integration Testing', description: 'Integration' },
              { title: 'Lesson 3: End-to-End Testing', description: 'E2E testing' }
            ],
            quiz: {
              title: 'QA Knowledge Check Quiz',
              timeLimitMinutes: 10,
              passingScorePercent: 50,
              questions: [
                { questionText: 'Q1: What is E2E testing?', options: ['Full pipeline test', 'Unit test'], correctAnswerIndex: 0 }
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

      // Assign training
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: { assignmentType: 'specific', trainingId: training._id, employeeIds: [empId] }
      });

      const assignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: empCookie } });
      const trainingAssignmentId = assignRes.body.data.assignments[0]._id;

      // 4. Test 0/4 Completed (0%)
      console.log('\n4. Verifying 0 / 4 Completed ratio (0%)...');
      const prog0 = await makeRequest({ method: 'GET', path: `/api/progress/${trainingAssignmentId}`, headers: { Cookie: empCookie } });
      console.log('   Progress at 0/4:', prog0.body.data.progress.progressPercentage + '%');
      if (prog0.body.data.progress.progressPercentage !== 0) throw new Error(`Expected 0% at 0/4, got ${prog0.body.data.progress.progressPercentage}%`);

      // 5. Test 1/4 Completed (25%)
      console.log('\n5. Verifying 1 / 4 Completed ratio (25%)...');
      const step1 = await makeRequest({ method: 'POST', path: '/api/progress/complete-subsection', headers: { Cookie: empCookie }, body: { trainingAssignmentId, subSectionId: subSections[0]._id } });
      console.log('   Progress at 1/4:', step1.body.data.percentage + '%');
      if (step1.body.data.percentage !== 25) throw new Error(`Expected 25% at 1/4, got ${step1.body.data.percentage}%`);

      // 6. Test 2/4 Completed (50%)
      console.log('\n6. Verifying 2 / 4 Completed ratio (50%)...');
      const step2 = await makeRequest({ method: 'POST', path: '/api/progress/complete-subsection', headers: { Cookie: empCookie }, body: { trainingAssignmentId, subSectionId: subSections[1]._id } });
      console.log('   Progress at 2/4:', step2.body.data.percentage + '%');
      if (step2.body.data.percentage !== 50) throw new Error(`Expected 50% at 2/4, got ${step2.body.data.percentage}%`);

      // 7. Test 3/4 Completed (75%)
      console.log('\n7. Verifying 3 / 4 Completed ratio (75%)...');
      const step3 = await makeRequest({ method: 'POST', path: '/api/progress/complete-subsection', headers: { Cookie: empCookie }, body: { trainingAssignmentId, subSectionId: subSections[2]._id } });
      console.log('   Progress at 3/4:', step3.body.data.percentage + '%');
      if (step3.body.data.percentage !== 75) throw new Error(`Expected 75% at 3/4, got ${step3.body.data.percentage}%`);

      // 8. Test 4/4 Completed (100%)
      console.log('\n8. Verifying 4 / 4 Completed ratio (100%)...');
      const qStart = await makeRequest({ method: 'POST', path: `/api/quizzes/${quizId}/start`, headers: { Cookie: empCookie }, body: { trainingAssignmentId } });
      await makeRequest({ method: 'POST', path: `/api/quizzes/${quizId}/submit`, headers: { Cookie: empCookie }, body: { trainingAssignmentId, attemptId: qStart.body.data.attempt._id, userAnswers: [{ questionIndex: 0, selectedOptionIndex: 0 }] } });

      const progFinal = await makeRequest({ method: 'GET', path: `/api/progress/${trainingAssignmentId}`, headers: { Cookie: empCookie } });
      console.log('   Final Progress at 4/4:', progFinal.body.data.assignment.progressPercentage + '%', 'Status:', progFinal.body.data.assignment.status);

      if (progFinal.body.data.assignment.progressPercentage !== 100 || progFinal.body.data.assignment.status !== 'Completed') {
        throw new Error(`Expected 100% Completed at 4/4, got ${progFinal.body.data.assignment.progressPercentage}% (${progFinal.body.data.assignment.status})`);
      }

      console.log('\n🎉 ALL 5 PROGRESS RATIOS (0/4=0%, 1/4=25%, 2/4=50%, 3/4=75%, 4/4=100%) VERIFIED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

run4OutOf4E2ETest();
