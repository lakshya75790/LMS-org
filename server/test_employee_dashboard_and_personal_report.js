const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5015 }) {
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

async function runEmployeeDashboardReportE2ETest() {
  console.log('🚀 Running E2E Verification for Employee Dashboard & Personal Report with REAL Data...\n');

  await connectDB();

  const server = app.listen(5015, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `rep_admin_${ts}@test.com`;
      const instEmail = `rep_inst_${ts}@test.com`;
      const empEmail = `rep_learner_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Report Testing Org ${ts}`,
          orgCode: `RTO${ts.toString().slice(-4)}`,
          adminName: 'Report Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Create Category, Instructor, and Employee
      console.log('\n2. Registering Instructor & Employee...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Professional Development' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Prof. Learning Guide', email: instEmail, password: 'Password123' }
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
        body: { name: 'Harshita Learner', email: empEmail, password: 'Password123', orgCode }
      });
      const empId = empReg.body.data.user._id;

      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;

      // 3. Instructor creates Course with Sections, Quiz, & Assignment
      console.log('\n3. Instructor creating course with Sections, Quiz, & Assignment...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Professional Communication & Workplace Skills',
          description: 'Master interpersonal communication in corporate environments',
          categoryId: catId,
          status: 'published',
          sections: [
            {
              title: 'Module 1: Workplace Communication',
              lectures: [
                { title: 'Lesson 1.1: Active Listening', description: 'Techniques for listening', videoUrl: 'https://cdn.example.com/c1.mp4' },
                { title: 'Lesson 1.2: Verbal Clarity', description: 'Clear expression', videoUrl: 'https://cdn.example.com/c2.mp4' }
              ],
              quiz: {
                title: 'Workplace Communication Quiz',
                timeLimitMinutes: 15,
                passingScorePercent: 70,
                questions: [
                  { questionText: 'What is active listening?', options: ['Nodding only', 'Understanding message fully', 'Ignoring speaker', 'Interrupting'], correctAnswerIndex: 1 },
                  { questionText: 'Which is key for non-verbal communication?', options: ['Tone & posture', 'Speed', 'Loudness', 'Font size'], correctAnswerIndex: 0 }
                ]
              }
            },
            {
              title: 'Module 2: Collaboration',
              lectures: [
                { title: 'Lesson 2.1: Teamwork Strategies', description: 'Collaboration skills', videoUrl: 'https://cdn.example.com/c3.mp4' }
              ]
            }
          ],
          assignment: {
            title: 'Teamwork Situation Report',
            instructions: 'Submit a case study of effective teamwork.'
          }
        }
      });

      const training = courseRes.body.data.training;
      const trainingId = training._id;
      const sec1Sub1 = training.sections[0].subSections[0];
      const sec1Sub2 = training.sections[0].subSections[1];
      const sec2Sub1 = training.sections[1].subSections[0];
      const quizId = sec1Sub1.quizId?._id || sec1Sub1.quizId;

      const assignmentObj = await makeRequest({
        method: 'GET',
        path: `/api/assignments/${trainingId}`,
        headers: { Cookie: empCookie }
      });
      const assignmentId = assignmentObj.body.data.assignment._id;

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

      const myAssignsRes = await makeRequest({
        method: 'GET',
        path: '/api/assignments-engine/my-assignments',
        headers: { Cookie: empCookie }
      });
      const trainingAssignmentId = myAssignsRes.body.data.assignments[0]._id;

      // 5. Initial Report Check
      console.log('\n5. Fetching Initial Employee Personal Report...');
      let repRes = await makeRequest({
        method: 'GET',
        path: '/api/reports/my-report',
        headers: { Cookie: empCookie }
      });
      if (!repRes.body || !repRes.body.data) {
        console.error('API Error Response:', repRes.statusCode, repRes.body);
        throw new Error('GET /api/reports/my-report returned invalid body');
      }

      console.log('   Assigned:', repRes.body.data.overview.totalAssigned);
      console.log('   Completed:', repRes.body.data.overview.completedCourses);
      console.log('   In Progress:', repRes.body.data.overview.inProgressAssignments);
      console.log('   Overall Progress:', repRes.body.data.overview.overallProgress + '%');

      // 6. Complete Lessons
      console.log('\n6. Employee completing Lessons 1.1 & 1.2...');
      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec1Sub1._id }
      });
      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec1Sub2._id }
      });

      // 7. Attempt Quiz (Attempt 1: 50% - Failed)
      console.log('\n7. Quiz Attempt 1 (Failed 50%)...');
      await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 1 }, // Correct
            { questionIndex: 1, selectedOptionIndex: 1 }  // Incorrect
          ],
          trainingAssignmentId
        }
      });

      // 8. Attempt Quiz (Attempt 2: 100% - Passed)
      console.log('\n8. Quiz Attempt 2 (Passed 100%)...');
      await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 1 }, // Correct
            { questionIndex: 1, selectedOptionIndex: 0 }  // Correct
          ],
          trainingAssignmentId
        }
      });

      // 9. Complete Lesson 2.1 & Submit Assignment
      console.log('\n9. Completing Lesson 2.1 & Submitting Project Assignment...');
      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec2Sub1._id }
      });

      await makeRequest({
        method: 'POST',
        path: `/api/assignments/${assignmentId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          submissionType: 'github',
          githubUrl: 'https://github.com/harshita/communication-report',
          trainingAssignmentId
        }
      });

      // 10. Re-fetch Personal Report
      console.log('\n10. Fetching Updated Personal Report & Verifying Real Database Data...');
      repRes = await makeRequest({
        method: 'GET',
        path: '/api/reports/my-report',
        headers: { Cookie: empCookie }
      });

      const data = repRes.body.data;
      console.log('    Assigned Courses:', data.overview.totalAssigned);
      console.log('    Completed Courses:', data.overview.completedCourses);
      console.log('    In Progress Courses:', data.overview.inProgressAssignments);
      console.log('    Overall Progress:', data.overview.overallProgress + '%');
      console.log('    Average Quiz Score:', data.overview.averageQuizScore + '%');
      console.log('    Total Quiz Attempts Preserved:', data.quizAttempts.length);
      console.log('    Attempt 1 Score & Status:', data.quizAttempts[1]?.percentage + '%', data.quizAttempts[1]?.passed ? 'PASSED' : 'FAILED');
      console.log('    Attempt 2 Score & Status:', data.quizAttempts[0]?.percentage + '%', data.quizAttempts[0]?.passed ? 'PASSED' : 'FAILED');
      console.log('    Assignment Submission Status:', data.assignmentSubmissions[0]?.status);
      console.log('    Instructor Name in Transcript:', data.assignments[0]?.instructorName);

      if (
        data.overview.totalAssigned === 1 &&
        data.overview.completedCourses === 1 &&
        data.overview.inProgressAssignments === 0 &&
        data.overview.overallProgress === 100 &&
        data.overview.averageQuizScore === 75 &&
        data.quizAttempts.length === 2 &&
        data.assignments[0]?.instructorName === 'Prof. Learning Guide' &&
        data.assignments[0]?.status === 'Completed'
      ) {
        console.log('\n🎉 EMPLOYEE DASHBOARD & PERSONAL REPORT E2E TEST PASSED PERFECTLY! 🎉');
      } else {
        throw new Error('Employee dashboard & personal report E2E verification failed');
      }

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runEmployeeDashboardReportE2ETest();
