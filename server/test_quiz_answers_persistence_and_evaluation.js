const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const QuizAttempt = require('./models/QuizAttempt');

function makeRequest({ method, path, headers = {}, body = null, port = 5016 }) {
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

async function runQuizAnswersPersistenceE2ETest() {
  console.log('🚀 Running E2E Verification for Quiz Selected Answers Persistence & Evaluation...\n');

  await connectDB();

  const server = app.listen(5016, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `quiz_admin_${ts}@test.com`;
      const instEmail = `quiz_inst_${ts}@test.com`;
      const empEmail = `quiz_emp_${ts}@test.com`;

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
      console.log('\n2. Registering Instructor & Employee...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Workplace Excellence' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Dr. Workplace Expert', email: instEmail, password: 'Password123' }
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
        body: { name: 'Aarav Learner', email: empEmail, password: 'Password123', orgCode }
      });
      const empId = empReg.body.data.user._id;

      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;

      // 3. Create Course with 5-Question Quiz ("Workplace Communication Basics")
      console.log('\n3. Instructor creating course with 5-Question Quiz...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Workplace Communication Basics',
          description: 'Essential communication techniques for corporate success',
          categoryId: catId,
          status: 'published',
          sections: [
            {
              title: 'Module 1: Effective Communication',
              lectures: [
                { title: 'Lesson 1.1: Active Listening Skills', description: 'Listening techniques', videoUrl: 'https://cdn.example.com/v1.mp4' }
              ],
              quiz: {
                title: 'Workplace Communication Assessment',
                timeLimitMinutes: 15,
                passingScorePercent: 70,
                questions: [
                  { questionText: 'What is active listening?', options: ['Nodding passively', 'Understanding message fully and providing feedback', 'Ignoring speaker', 'Interrupting constantly'], correctAnswerIndex: 1 },
                  { questionText: 'Which helps a team work better together?', options: ['Aggressive competition', 'Trust and open communication', 'Complete silence', 'Avoiding feedback'], correctAnswerIndex: 1 },
                  { questionText: 'What should you do when non-verbal cues contradict verbal messages?', options: ['Ignore non-verbal cues', 'Clarify respectfully with the speaker', 'Assume hostility', 'End conversation immediately'], correctAnswerIndex: 1 },
                  { questionText: 'What is constructive feedback?', options: ['Personal criticism', 'Specific actionable advice for growth', 'Vague compliments', 'Public scolding'], correctAnswerIndex: 1 },
                  { questionText: 'How should technical information be communicated to non-technical stakeholders?', options: ['Use complex jargon only', 'Use clear simple analogies and plain language', 'Send raw source code', 'Refuse to explain'], correctAnswerIndex: 1 }
                ]
              }
            }
          ]
        }
      });

      const training = courseRes.body.data.training;
      const quizId = training.sections[0].subSections[0].quizId?._id || training.sections[0].subSections[0].quizId;

      // 4. Admin assigns training to Employee
      console.log('\n4. Assigning Training to Employee...');
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: {
          assignmentType: 'specific',
          trainingId: training._id,
          employeeIds: [empId]
        }
      });

      const myAssignsRes = await makeRequest({
        method: 'GET',
        path: '/api/assignments-engine/my-assignments',
        headers: { Cookie: empCookie }
      });
      const trainingAssignmentId = myAssignsRes.body.data.assignments[0]._id;

      // 5. Submit Attempt 1 (Answers Q1-Q4 correctly/incorrectly, Q5 LEFT UNANSWERED)
      console.log('\n5. Submitting Attempt 1 (Q1->1 [Correct], Q2->0 [Incorrect], Q3->1 [Correct], Q4->1 [Correct], Q5->Unanswered)...');
      const submitAtt1 = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 1 }, // Correct: "Understanding message fully and providing feedback"
            { questionIndex: 1, selectedOptionIndex: 0 }, // Incorrect: "Aggressive competition"
            { questionIndex: 2, selectedOptionIndex: 1 }, // Correct: "Clarify respectfully with the speaker"
            { questionIndex: 3, selectedOptionIndex: 1 }  // Correct: "Specific actionable advice for growth"
            // Q5 left unsubmitted (unanswered)
          ],
          trainingAssignmentId
        }
      });

      console.log('   Attempt 1 Response Score:', submitAtt1.body.data.percentage + '%', 'Passed:', submitAtt1.body.data.passed);

      // Verify MongoDB Document for Attempt 1
      const dbAtt1 = await QuizAttempt.findOne({ _id: submitAtt1.body.data.attempt._id });
      console.log('   MongoDB Check Attempt 1 Answers:');
      console.log('   Q1 Text:', dbAtt1.answers[0].selectedAnswerText);
      console.log('   Q2 Text:', dbAtt1.answers[1].selectedAnswerText);
      console.log('   Q5 Selected Index:', dbAtt1.answers[4].selectedOptionIndex);

      if (dbAtt1.answers[0].selectedAnswerText !== 'Understanding message fully and providing feedback') {
        throw new Error('Attempt 1 Q1 selectedAnswerText was not persisted in MongoDB!');
      }
      if (dbAtt1.answers[1].selectedAnswerText !== 'Aggressive competition') {
        throw new Error('Attempt 1 Q2 selectedAnswerText was not persisted in MongoDB!');
      }
      if (dbAtt1.answers[4].selectedOptionIndex !== null) {
        throw new Error('Attempt 1 Q5 should have selectedOptionIndex: null for unanswered question!');
      }

      // 6. Submit Attempt 2 (Retake with 100% Correct Answers on ALL 5 Questions)
      console.log('\n6. Submitting Attempt 2 (All 5 Questions Answered Correctly -> 100%)...');
      const submitAtt2 = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 1 }, // Correct
            { questionIndex: 1, selectedOptionIndex: 1 }, // Correct: "Trust and open communication"
            { questionIndex: 2, selectedOptionIndex: 1 }, // Correct
            { questionIndex: 3, selectedOptionIndex: 1 }, // Correct
            { questionIndex: 4, selectedOptionIndex: 1 }  // Correct: "Use clear simple analogies and plain language"
          ],
          trainingAssignmentId
        }
      });

      console.log('   Attempt 2 Response Score:', submitAtt2.body.data.percentage + '%', 'Passed:', submitAtt2.body.data.passed);

      // Verify Attempt 1 remains untouched in MongoDB
      const dbAtt1After = await QuizAttempt.findOne({ _id: submitAtt1.body.data.attempt._id });
      if (dbAtt1After.answers[1].selectedAnswerText !== 'Aggressive competition') {
        throw new Error('Attempt 1 was overwritten by Attempt 2 in MongoDB!');
      }

      // 7. Verify Personal Report API Data (`GET /api/reports/my-report`)
      console.log('\n7. Fetching Personal Training Report & Verifying Question Evaluations...');
      const repRes = await makeRequest({
        method: 'GET',
        path: '/api/reports/my-report',
        headers: { Cookie: empCookie }
      });

      const attemptsFromApi = repRes.body.data.quizAttempts;
      console.log('   Total Attempts in API:', attemptsFromApi.length);

      const att2Api = attemptsFromApi.find(a => a.attemptNumber === 2);
      const att1Api = attemptsFromApi.find(a => a.attemptNumber === 1);

      console.log('\n   API Attempt 1 Evaluation:');
      att1Api.answers.forEach((ans, i) => {
        console.log(`   Q${i + 1}: ${ans.status.toUpperCase()} | Your Answer: "${ans.selectedAnswerText || (ans.status === 'not_answered' ? 'Not Answered' : '')}" | Correct: "${ans.correctAnswerText}"`);
      });

      console.log('\n   API Attempt 2 Evaluation:');
      att2Api.answers.forEach((i, ans) => {
        console.log(`   Q${ans + 1}: ${i.status.toUpperCase()} | Your Answer: "${i.selectedAnswerText}" | Correct: "${i.correctAnswerText}"`);
      });

      // Assertions
      if (att1Api.answers[0].selectedAnswerText !== 'Understanding message fully and providing feedback') {
        throw new Error('Attempt 1 Q1 selectedAnswerText invalid in API response');
      }
      if (att1Api.answers[1].selectedAnswerText !== 'Aggressive competition') {
        throw new Error('Attempt 1 Q2 selectedAnswerText invalid in API response');
      }
      if (att1Api.answers[4].status !== 'not_answered') {
        throw new Error('Attempt 1 Q5 should have status: not_answered');
      }

      if (att2Api.answers[1].selectedAnswerText !== 'Trust and open communication') {
        throw new Error('Attempt 2 Q2 selectedAnswerText invalid in API response');
      }
      if (att2Api.answers[4].selectedAnswerText !== 'Use clear simple analogies and plain language') {
        throw new Error('Attempt 2 Q5 selectedAnswerText invalid in API response');
      }
      if (att2Api.answers[4].status !== 'correct') {
        throw new Error('Attempt 2 Q5 should have status: correct');
      }

      console.log('\n🎉 QUIZ SELECTED ANSWERS PERSISTENCE & EVALUATION E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runQuizAnswersPersistenceE2ETest();
