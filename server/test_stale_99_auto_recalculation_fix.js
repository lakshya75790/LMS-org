const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const TrainingAssignment = require('./models/TrainingAssignment');
const TrainingProgress = require('./models/TrainingProgress');

function makeRequest({ method, path, headers = {}, body = null, port = 5028 }) {
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

async function runStaleRecalculationE2ETest() {
  console.log('🚀 Running E2E Verification for Stale 99% Progress Auto-Recalculation & 100% Completion Fix...\n');

  await connectDB();

  const server = app.listen(5028, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `stale_admin_${ts}@test.com`;
      const instEmail = `stale_inst_${ts}@test.com`;
      const empEmail = `stale_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Stale 99 Test Org ${ts}`,
          orgCode: `S99${ts.toString().slice(-4)}`,
          adminName: 'Stale Admin',
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
        body: { name: 'HR Relations' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'HR Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'Password123' } });
      const instCookie = instLogin.cookie;

      const eReg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Lakshya Joshi', email: empEmail, password: 'Password123', orgCode } });
      const empId = eReg.body.data.user._id;
      const empLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: empEmail, password: 'Password123' } });
      const empCookie = empLogin.cookie;

      // 3. Create Course with 2 Lessons + 1 Quiz + 1 Assignment
      console.log('\n3. Creating HR Course with 2 Lessons + 1 Quiz + 1 Assignment...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'HR Employee Relations & Workplace Conflict Management',
          description: 'Conflict resolution and relations',
          categoryId: catId,
          status: 'published',
          assignment: {
            title: 'Workplace Conflict Case Study',
            instructions: 'Analyze scenario.'
          },
          sections: [{
            title: 'Conflict Resolution',
            lectures: [
              { title: 'Lesson 1: Intro to Conflict', description: 'desc' },
              { title: 'Lesson 2: Mediation Techniques', description: 'desc' }
            ],
            quiz: {
              title: 'Conflict Management Quiz',
              timeLimitMinutes: 10,
              passingScorePercent: 50,
              questions: [
                { questionText: 'Q1: What is mediation?', options: ['Resolution process', 'Argument', 'None'], correctAnswerIndex: 0 }
              ]
            }
          }]
        }
      });

      const training = courseRes.body.data.training;
      const subSections = training.sections[0].subSections;

      let quizId = null;
      let assignmentId = null;

      subSections.forEach(sub => {
        if (sub.quizId) quizId = sub.quizId._id || sub.quizId;
        if (sub.assignmentId) assignmentId = sub.assignmentId._id || sub.assignmentId;
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

      // 4. Complete 2 Lessons, 1 Quiz, 1 Assignment
      console.log('\n4. Employee completes Lesson 1, Lesson 2, Quiz, and Assignment...');
      await makeRequest({ method: 'POST', path: '/api/progress/complete-subsection', headers: { Cookie: empCookie }, body: { trainingAssignmentId, subSectionId: subSections[0]._id } });
      await makeRequest({ method: 'POST', path: '/api/progress/complete-subsection', headers: { Cookie: empCookie }, body: { trainingAssignmentId, subSectionId: subSections[1]._id } });

      const qStart = await makeRequest({ method: 'POST', path: `/api/quizzes/${quizId}/start`, headers: { Cookie: empCookie }, body: { trainingAssignmentId } });
      await makeRequest({ method: 'POST', path: `/api/quizzes/${quizId}/submit`, headers: { Cookie: empCookie }, body: { trainingAssignmentId, attemptId: qStart.body.data.attempt._id, userAnswers: [{ questionIndex: 0, selectedOptionIndex: 0 }] } });

      await makeRequest({ method: 'POST', path: `/api/assignments/${assignmentId}/submit`, headers: { Cookie: empCookie }, body: { submissionType: 'github', githubUrl: 'https://github.com/user/case-study', trainingAssignmentId } });

      // 5. MANUALLY SIMULATE A STALE DB RECORD (progressPercentage: 99, status: 'In Progress')
      console.log('\n5. Manually simulating a stale database record (progressPercentage: 99, status: "In Progress")...');
      await TrainingAssignment.findByIdAndUpdate(trainingAssignmentId, { progressPercentage: 99, status: 'In Progress' });
      await TrainingProgress.findOneAndUpdate({ trainingAssignmentId }, { progressPercentage: 99 });

      const staleCheck = await TrainingAssignment.findById(trainingAssignmentId);
      console.log('   Stale DB Record before fetch: Progress =', staleCheck.progressPercentage + '%', 'Status =', staleCheck.status);

      // 6. Call GET /api/assignments-engine/my-assignments (My Assigned Trainings API)
      console.log('\n6. Fetching My Assigned Trainings API (GET /api/assignments-engine/my-assignments)...');
      const myAssignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: empCookie } });

      const myAss = myAssignRes.body.data.assignments[0];
      console.log('   API Returned Progress Percentage:', myAss.progressPercentage + '%');
      console.log('   API Returned Status:', myAss.status);

      const dbCheckAfter = await TrainingAssignment.findById(trainingAssignmentId);
      console.log('   Database Record Progress after fetch:', dbCheckAfter.progressPercentage + '%', 'Status:', dbCheckAfter.status);

      if (myAss.progressPercentage !== 100 || myAss.status !== 'Completed' || dbCheckAfter.progressPercentage !== 100) {
        throw new Error('Auto-recalculation of stale 99% record failed! Expected 100% Completed.');
      }

      console.log('\n🎉 STALE 99% PROGRESS AUTO-RECALCULATION E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runStaleRecalculationE2ETest();
