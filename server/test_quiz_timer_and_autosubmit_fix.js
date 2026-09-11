const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const QuizAttempt = require('./models/QuizAttempt');

function makeRequest({ method, path, headers = {}, body = null, port = 5025 }) {
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

async function runQuizTimerAndAutoSubmitE2ETest() {
  console.log('🚀 Running E2E Verification for Quiz Timer & Auto-Submit Fix...\n');

  await connectDB();

  const server = app.listen(5025, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `quiz_admin_${ts}@test.com`;
      const instEmail = `quiz_inst_${ts}@test.com`;
      const empEmail = `quiz_harshita_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Quiz Test Org ${ts}`,
          orgCode: `QTO${ts.toString().slice(-4)}`,
          adminName: 'Quiz Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Register Instructor & Employee
      console.log('\n2. Registering Instructor & Employee (Harshita)...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Safety Training' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Quiz Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'Password123' } });
      const instCookie = instLogin.cookie;

      const eReg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Harshita Paliwal', email: empEmail, password: 'Password123', orgCode } });
      const empId = eReg.body.data.user._id;
      const empLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: empEmail, password: 'Password123' } });
      const empCookie = empLogin.cookie;

      // 3. Create Course with Quiz
      console.log('\n3. Creating Course with 2-Question Quiz (1 min time limit)...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Workplace Safety Protocols',
          description: 'Emergency protocols',
          categoryId: catId,
          status: 'published',
          sections: [{
            title: 'Safety Section',
            lectures: [{ title: 'Safety Lecture', description: 'desc', videoUrl: 'https://cdn.example.com/v1.mp4' }],
            quiz: {
              title: 'Safety Assessment Quiz 1',
              timeLimitMinutes: 1,
              passingScorePercent: 50,
              questions: [
                { questionText: 'Q1: Emergency number?', options: ['911', '100', '000', '112'], correctAnswerIndex: 0 },
                { questionText: 'Q2: Fire exit color?', options: ['Red', 'Green', 'Blue', 'Yellow'], correctAnswerIndex: 1 }
              ]
            }
          }]
        }
      });
      const training = courseRes.body.data.training;
      const quiz1Id = training.sections[0].subSections[0].quizId._id || training.sections[0].subSections[0].quizId;

      // Assign training
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: { assignmentType: 'specific', trainingId: training._id, employeeIds: [empId] }
      });

      const assignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: empCookie } });
      const assignmentId = assignRes.body.data.assignments[0]._id;

      // 4. SCENARIO 1: Start Quiz & Verify Persistent Attempt Start Time
      console.log('\n4. [SCENARIO 1] Starting Quiz Attempt (POST /api/quizzes/:id/start)...');
      const start1 = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quiz1Id}/start`,
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignmentId }
      });

      console.log('   Start API Status:', start1.statusCode, 'Status:', start1.body.data.attempt.status);
      console.log('   Start Time:', start1.body.data.startTime, 'Remaining Seconds:', start1.body.data.remainingSeconds);

      if (start1.statusCode !== 200 && start1.statusCode !== 201) {
        throw new Error('Failed to start quiz attempt!');
      }

      // Re-call startQuiz (simulating page refresh)
      console.log('   Simulating page refresh / re-call startQuiz...');
      const startRefresh = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quiz1Id}/start`,
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignmentId }
      });
      console.log('   Refreshed Remaining Seconds:', startRefresh.body.data.remainingSeconds);

      // 5. SCENARIO 2: Manual Submission (Pass 100%)
      console.log('\n5. [SCENARIO 2] Manual Quiz Submission with all correct answers...');
      const sub1Res = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quiz1Id}/submit`,
        headers: { Cookie: empCookie },
        body: {
          trainingAssignmentId: assignmentId,
          attemptId: start1.body.data.attempt._id,
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 0 },
            { questionIndex: 1, selectedOptionIndex: 1 }
          ]
        }
      });
      console.log('   Submit Status Code:', sub1Res.statusCode);
      console.log('   Passed?:', sub1Res.body.data.passed, 'Percentage:', sub1Res.body.data.percentage);

      if (!sub1Res.body.data.passed || sub1Res.body.data.percentage !== 100) {
        throw new Error('Manual quiz submission failed or returned incorrect score!');
      }

      // 6. SCENARIO 3: Timer Reaches 00:00 with Unanswered Question (Auto-Submit)
      console.log('\n6. [SCENARIO 3] Creating Quiz 2 & Testing Auto-Submit on Timeout with Unanswered Question...');
      const quiz2Res = await makeRequest({
        method: 'POST',
        path: '/api/quizzes',
        headers: { Cookie: instCookie },
        body: {
          title: 'Safety Assessment Quiz 2',
          trainingId: training._id,
          subSectionId: training.sections[0].subSections[0]._id,
          timeLimitMinutes: 1,
          passingScorePercent: 50,
          questions: [
            { questionText: 'Q1: First aid kit location?', options: ['Lobby', 'Break Room', 'Office', 'Roof'], correctAnswerIndex: 1 },
            { questionText: 'Q2: Emergency assembly point?', options: ['Parking Lot', 'Basement', 'Elevator', 'Stairs'], correctAnswerIndex: 0 }
          ]
        }
      });
      const quiz2Id = quiz2Res.body.data.quiz._id;

      const start2 = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quiz2Id}/start`,
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignmentId }
      });

      // Auto-submit: Harshita answered Q1 (correct) but Q2 was left unanswered when timer expired!
      console.log('   Auto-submitting Quiz 2 (Q1 answered, Q2 unanswered)...');
      const autoSubRes = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quiz2Id}/submit`,
        headers: { Cookie: empCookie },
        body: {
          trainingAssignmentId: assignmentId,
          attemptId: start2.body.data.attempt._id,
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 1 } // Only Q1 answered!
          ]
        }
      });

      const autoResult = autoSubRes.body.data;
      console.log('   Auto-Submit Status Code:', autoSubRes.statusCode);
      console.log('   Score Percentage:', autoResult.percentage, 'Passed?:', autoResult.passed);
      console.log('   Q1 Answered:', autoResult.evaluatedAnswers[0].selectedAnswerText, 'IsCorrect:', autoResult.evaluatedAnswers[0].isCorrect);
      console.log('   Q2 Answered:', autoResult.evaluatedAnswers[1].selectedAnswerText, 'IsCorrect:', autoResult.evaluatedAnswers[1].isCorrect);

      if (autoResult.percentage !== 50 || autoResult.evaluatedAnswers[1].selectedOptionIndex !== null) {
        throw new Error('Auto-submit with unanswered question produced incorrect score or answers!');
      }

      // 7. SCENARIO 4: Idempotent Submission Guard
      console.log('\n7. [SCENARIO 4] Testing Idempotency (Submitting already completed attempt again)...');
      const dupSubRes = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quiz2Id}/submit`,
        headers: { Cookie: empCookie },
        body: {
          trainingAssignmentId: assignmentId,
          attemptId: start2.body.data.attempt._id,
          userAnswers: [{ questionIndex: 0, selectedOptionIndex: 1 }]
        }
      });

      console.log('   Duplicate Submit Status Code:', dupSubRes.statusCode);
      console.log('   Duplicate Response Percentage:', dupSubRes.body.data.percentage);

      const totalAttemptsInDb = await QuizAttempt.countDocuments({ quizId: quiz2Id, employeeId: empId });
      console.log('   Total Attempt Docs in DB for Quiz 2 (Should be 1):', totalAttemptsInDb);

      if (dupSubRes.statusCode !== 200 || totalAttemptsInDb !== 1) {
        throw new Error('Idempotency failed! Created duplicate attempt documents in database.');
      }

      console.log('\n🎉 QUIZ TIMER & AUTO-SUBMIT FIX E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runQuizTimerAndAutoSubmitE2ETest();
