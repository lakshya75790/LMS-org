const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const QuizAttempt = require('./models/QuizAttempt');
const AssignmentSubmission = require('./models/AssignmentSubmission');

function makeRequest({ method, path, headers = {}, body = null, port = 5026 }) {
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

async function runFinalE2ETest() {
  console.log('🚀 Running Final E2E Verification for Quiz Submission Result Persistence & Assignment Progress Gating...\n');

  await connectDB();

  const server = app.listen(5026, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `final_admin_${ts}@test.com`;
      const instEmail = `final_inst_${ts}@test.com`;
      const empEmail = `final_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Final Test Org ${ts}`,
          orgCode: `FTO${ts.toString().slice(-4)}`,
          adminName: 'Final Admin',
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
        body: { name: 'Leadership & Compliance' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Lead Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'Password123' } });
      const instCookie = instLogin.cookie;

      const eReg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Aman Kumar', email: empEmail, password: 'Password123', orgCode } });
      const empId = eReg.body.data.user._id;
      const empLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: empEmail, password: 'Password123' } });
      const empCookie = empLogin.cookie;

      // 3. Create Course with 2 Lessons + 1 Quiz + 1 Assignment
      console.log('\n3. Creating Course with 2 Lessons + 1 Quiz + 1 Assignment...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Advanced Workplace Ethics',
          description: 'Compliance and ethics training',
          categoryId: catId,
          status: 'published',
          assignment: {
            title: 'Ethics Case Study Assignment',
            instructions: 'Analyze ethics scenario and submit report.'
          },
          sections: [{
            title: 'Ethics Basics',
            lectures: [
              { title: 'Lesson 1: Intro to Ethics', description: 'desc', videoUrl: 'https://cdn.example.com/v1.mp4' },
              { title: 'Lesson 2: Conflict of Interest', description: 'desc', videoUrl: 'https://cdn.example.com/v2.mp4' }
            ],
            quiz: {
              title: 'Ethics Comprehension Quiz',
              timeLimitMinutes: 15,
              passingScorePercent: 50,
              questions: [
                { questionText: 'Q1: What is conflict of interest?', options: ['Personal gain over company interest', 'Hard work', 'Teamwork', 'None'], correctAnswerIndex: 0 }
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

      console.log('   Training Created ID:', training._id, 'Quiz ID:', quizId, 'Assignment ID:', assignmentId);

      // Assign training to employee
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: { assignmentType: 'specific', trainingId: training._id, employeeIds: [empId] }
      });

      const assignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: empCookie } });
      const trainingAssignmentId = assignRes.body.data.assignments[0]._id;

      // 4. TEST QUIZ SUBMISSION & PROGRESS RETRIEVAL PERSISTENCE
      console.log('\n4. Testing Quiz Start & Submission...');
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
      console.log('   Quiz Submission Result:', qSub.body.data.passed, 'Score:', qSub.body.data.percentage);

      // Verify GET /api/progress/:trainingAssignmentId returns the completed attempt with answers
      console.log('   Verifying GET /api/progress returns completed attempt details...');
      const progRes1 = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });
      const attemptsInProg = progRes1.body.data.quizAttempts;
      console.log('   Quiz Attempts returned in Progress API count:', attemptsInProg.length);
      console.log('   Quiz Attempt Status:', attemptsInProg[0]?.status, 'Passed?:', attemptsInProg[0]?.passed);

      if (attemptsInProg.length === 0 || !attemptsInProg[0].passed) {
        throw new Error('Progress API failed to return completed quiz attempt details!');
      }

      // 5. TEST LESSON COMPLETIONS & ASSIGNMENT GATING
      console.log('\n5. Completing Lesson 1 & Lesson 2 (Quiz passed, Assignment NOT submitted)...');
      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: subSections[0]._id }
      });

      const l2Res = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: subSections[1]._id }
      });

      console.log('   Progress after Lessons + Quiz (Assignment Pending):', l2Res.body.data.percentage + '%', 'Status:', l2Res.body.data.assignmentStatus);

      if (l2Res.body.data.percentage === 100 || l2Res.body.data.assignmentStatus === 'Completed') {
        throw new Error('Assignment gating failed! Training was marked 100% Completed before assignment was submitted!');
      }

      // 6. TEST ASSIGNMENT SUBMISSION & 100% TRAINING COMPLETION
      console.log('\n6. Submitting Assignment and verifying 100% Training Completion...');
      const assSub = await makeRequest({
        method: 'POST',
        path: `/api/assignments/${assignmentId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          submissionType: 'github',
          githubUrl: 'https://github.com/user/ethics-case-study',
          trainingAssignmentId
        }
      });
      console.log('   Assignment Submitted Status:', assSub.body.data.submission.status);

      const progFinal = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });

      console.log('   Final Training Progress:', progFinal.body.data.assignment.progressPercentage + '%');
      console.log('   Final Training Assignment Status:', progFinal.body.data.assignment.status);

      if (progFinal.body.data.assignment.progressPercentage !== 100 || progFinal.body.data.assignment.status !== 'Completed') {
        throw new Error('Training completion calculation failed! Expected 100% Completed after assignment submission.');
      }

      console.log('\n🎉 FINAL E2E TEST FOR QUIZ PERSISTENCE & ASSIGNMENT GATING PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runFinalE2ETest();
