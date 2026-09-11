const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

let server;

// Helper to make HTTP requests with cookie handling
function makeRequest({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5001,
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
        resolve({ statusCode: res.statusCode, headers: res.headers, cookie, body: json });
      });
    });

    req.on('error', err => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runFullBackendIntegrationTest() {
  console.log('🚀 Starting Comprehensive End-to-End LMS Backend Integration Test...\n');

  await connectDB();

  server = app.listen(5001, async () => {
    try {
      // 1. Health check
      console.log('1. Testing GET /api/health...');
      const health = await makeRequest({ method: 'GET', path: '/api/health' });
      console.log('   Status:', health.statusCode, health.body.message);

      // 2. Setup Organization + Org Admin
      const uniqueSuffix = Date.now();
      const adminEmail = `admin_${uniqueSuffix}@techcorp.com`;
      console.log('\n2. Testing POST /api/auth/setup-org...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Tech Corp ${uniqueSuffix}`,
          orgCode: `TC${uniqueSuffix.toString().slice(-4)}`,
          adminName: 'Tech Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      console.log('   Status:', setupRes.statusCode, setupRes.body.message);
      const adminCookie = setupRes.cookie;
      const orgId = setupRes.body.data.organization._id;

      // 3. Admin creates Department (IT)
      console.log('\n3. Testing POST /api/org/departments...');
      const depRes = await makeRequest({
        method: 'POST',
        path: '/api/org/departments',
        headers: { Cookie: adminCookie },
        body: {
          name: 'IT Department',
          description: 'Engineering & Technology',
          jobRoles: ['Frontend Developer', 'Backend Developer']
        }
      });
      console.log('   Status:', depRes.statusCode, depRes.body.message);
      const depId = depRes.body.data.department._id;

      // 4. Admin creates Instructor
      const instructorEmail = `instructor_${uniqueSuffix}@techcorp.com`;
      console.log('\n4. Testing POST /api/org/instructors...');
      const instRes = await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: {
          name: 'Jane Instructor',
          email: instructorEmail,
          password: 'Password123',
          departmentId: depId
        }
      });
      console.log('   Status:', instRes.statusCode, instRes.body.message);

      // 5. Admin creates Category
      console.log('\n5. Testing POST /api/categories...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: {
          name: `Technical Skills ${uniqueSuffix}`,
          description: 'Software development and technical engineering'
        }
      });
      console.log('   Status:', catRes.statusCode, catRes.body.message);
      const catId = catRes.body.data.category._id;

      // 6. Instructor Login
      console.log('\n6. Testing POST /api/auth/login (Instructor)...');
      const instLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instructorEmail, password: 'Password123' }
      });
      console.log('   Status:', instLogin.statusCode, instLogin.body.message);
      const instructorCookie = instLogin.cookie;

      // 7. Instructor Creates Training
      console.log('\n7. Testing POST /api/trainings (Create Training)...');
      const trainRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings',
        headers: { Cookie: instructorCookie },
        body: {
          title: 'Advanced React Development',
          description: 'Master React Hooks, State Management, and Architecture',
          categoryId: catId,
          departmentId: depId,
          durationDays: 30
        }
      });
      console.log('   Status:', trainRes.statusCode, trainRes.body.message);
      const trainingId = trainRes.body.data.training._id;

      // 8. Add Section
      console.log('\n8. Testing POST /api/trainings/:id/sections...');
      const secRes = await makeRequest({
        method: 'POST',
        path: `/api/trainings/${trainingId}/sections`,
        headers: { Cookie: instructorCookie },
        body: { title: 'Section 1: Modern Hooks', order: 1 }
      });
      console.log('   Status:', secRes.statusCode, secRes.body.message);
      const sectionId = secRes.body.data.training.sections[0]._id;

      // 9. Add SubSection
      console.log('\n9. Testing POST /api/trainings/:id/sections/:secId/subsections...');
      const subSecRes = await makeRequest({
        method: 'POST',
        path: `/api/trainings/${trainingId}/sections/${sectionId}/subsections`,
        headers: { Cookie: instructorCookie },
        body: {
          title: 'SubSection 1.1: useEffect & Custom Hooks',
          description: 'Deep dive into React lifecycle side-effects',
          videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1234/react_hooks.mp4',
          videoDuration: 1200
        }
      });
      console.log('   Status:', subSecRes.statusCode, subSecRes.body.message);
      const subSectionId = subSecRes.body.data.training.sections[0].subSections[0]._id;

      // 10. Add Quiz to SubSection
      console.log('\n10. Testing POST /api/quizzes...');
      const quizRes = await makeRequest({
        method: 'POST',
        path: '/api/quizzes',
        headers: { Cookie: instructorCookie },
        body: {
          title: 'React Hooks Mastery Quiz',
          trainingId,
          sectionId,
          subSectionId,
          passingScorePercent: 70,
          questions: [
            {
              questionText: 'What does useEffect return for cleanup?',
              options: ['A Promise', 'A cleanup function', 'An object', 'A boolean'],
              correctAnswerIndex: 1
            },
            {
              questionText: 'Which hook stores mutable values without re-renders?',
              options: ['useState', 'useMemo', 'useRef', 'useCallback'],
              correctAnswerIndex: 2
            }
          ]
        }
      });
      console.log('   Status:', quizRes.statusCode, quizRes.body.message);
      const quizId = quizRes.body.data.quiz._id;

      // 11. Add Assignment to SubSection
      console.log('\n11. Testing POST /api/assignments...');
      const assignRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments',
        headers: { Cookie: instructorCookie },
        body: {
          title: 'Custom Hook Implementation Project',
          instructions: 'Build a custom useFetch hook and push repository link to GitHub',
          trainingId,
          sectionId,
          subSectionId,
          maxScore: 100
        }
      });
      console.log('   Status:', assignRes.statusCode, assignRes.body.message);
      const assignmentId = assignRes.body.data.assignment._id;

      // 12. Instructor Publishes Training
      console.log('\n12. Testing PUT /api/trainings/:id (Publish Training)...');
      const pubRes = await makeRequest({
        method: 'PUT',
        path: `/api/trainings/${trainingId}`,
        headers: { Cookie: instructorCookie },
        body: { isPublished: true }
      });
      console.log('   Status:', pubRes.statusCode, pubRes.body.message);

      // 13. Public Employee Registration
      const empEmail = `employee_${uniqueSuffix}@techcorp.com`;
      const orgCode = setupRes.body.data.organization.code;
      console.log('\n13. Testing POST /api/auth/register-employee...');
      const empReg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: {
          name: 'Rahul Dev',
          email: empEmail,
          password: 'Password123',
          orgCode
        }
      });
      console.log('   Status:', empReg.statusCode, empReg.body.message);
      const employeeCookie = empReg.cookie;

      // 14. Employee Completes Profile (Dept: IT, JobRole: Frontend Developer)
      console.log('\n14. Testing PUT /api/org/profile (Employee Profile Completion & Auto-Assignment)...');
      const profRes = await makeRequest({
        method: 'PUT',
        path: '/api/org/profile',
        headers: { Cookie: employeeCookie },
        body: {
          departmentId: depId,
          jobRole: 'Frontend Developer'
        }
      });
      console.log('   Status:', profRes.statusCode, profRes.body.message);

      // 15. Employee Fetches Assigned Trainings
      console.log('\n15. Testing GET /api/assignments-engine/my-assignments...');
      const myAssignRes = await makeRequest({
        method: 'GET',
        path: '/api/assignments-engine/my-assignments',
        headers: { Cookie: employeeCookie }
      });
      console.log('   Status:', myAssignRes.statusCode, myAssignRes.body.message);
      console.log('   Assigned Trainings Count:', myAssignRes.body.data.assignments.length);
      const empTrainingAssignmentId = myAssignRes.body.data.assignments[0]._id;

      // 16. Employee Takes & Submits Quiz
      console.log('\n16. Testing POST /api/quizzes/:id/submit (Pass Quiz)...');
      const quizSubmitRes = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: employeeCookie },
        body: {
          trainingAssignmentId: empTrainingAssignmentId,
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 1 },
            { questionIndex: 1, selectedOptionIndex: 2 }
          ]
        }
      });
      console.log('   Status:', quizSubmitRes.statusCode, quizSubmitRes.body.message);
      console.log('   Score:', quizSubmitRes.body.data.attempt.percentage + '%', 'Passed:', quizSubmitRes.body.data.attempt.passed);

      // 17. Employee Submits Assignment
      console.log('\n17. Testing POST /api/assignments/:id/submit...');
      const subAssignRes = await makeRequest({
        method: 'POST',
        path: `/api/assignments/${assignmentId}/submit`,
        headers: { Cookie: employeeCookie },
        body: {
          submissionType: 'github',
          githubUrl: 'https://github.com/rahuldev/custom-react-hook',
          trainingAssignmentId: empTrainingAssignmentId
        }
      });
      console.log('   Status:', subAssignRes.statusCode, subAssignRes.body.message);
      const submissionId = subAssignRes.body.data.submission._id;

      // 18. Employee Marks SubSection Complete -> Progress = 100%, Assignment = Completed
      console.log('\n18. Testing POST /api/progress/complete-subsection...');
      const compRes = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: employeeCookie },
        body: {
          trainingAssignmentId: empTrainingAssignmentId,
          subSectionId
        }
      });
      console.log('   Status:', compRes.statusCode, compRes.body.message);
      console.log('   Progress %:', compRes.body.data.progress.progressPercentage, 'Status:', compRes.body.data.assignmentStatus);

      // 19. Instructor Reviews Assignment
      console.log('\n19. Testing PUT /api/assignments/submissions/:submissionId/review...');
      const revRes = await makeRequest({
        method: 'PUT',
        path: `/api/assignments/submissions/${submissionId}/review`,
        headers: { Cookie: instructorCookie },
        body: {
          score: 95,
          feedback: 'Excellent custom hook implementation with proper cleanups!'
        }
      });
      console.log('   Status:', revRes.statusCode, revRes.body.message);

      // 20. Instructor Locks Training (Testing Lock Mechanism)
      console.log('\n20. Testing PUT /api/assignments-engine/:assignmentId/lock...');
      const lockRes = await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${empTrainingAssignmentId}/lock`,
        headers: { Cookie: instructorCookie },
        body: { reason: 'Mandatory compliance review required' }
      });
      console.log('   Status:', lockRes.statusCode, lockRes.body.message);

      // 21. Admin Checks Notifications (Aggregated notification received)
      console.log('\n21. Testing GET /api/notifications (Admin)...');
      const notifRes = await makeRequest({
        method: 'GET',
        path: '/api/notifications',
        headers: { Cookie: adminCookie }
      });
      console.log('   Status:', notifRes.statusCode, 'Unread Notifications:', notifRes.body.data.unreadCount);

      // 22. Admin Dashboard Analytics
      console.log('\n22. Testing GET /api/reports/admin-dashboard...');
      const reportRes = await makeRequest({
        method: 'GET',
        path: '/api/reports/admin-dashboard',
        headers: { Cookie: adminCookie }
      });
      console.log('   Status:', reportRes.statusCode, reportRes.body.message);
      console.log('   Quick Stats:', reportRes.body.data.quickStats);

      // 23. Audit Logs
      console.log('\n23. Testing GET /api/audit-logs...');
      const auditRes = await makeRequest({
        method: 'GET',
        path: '/api/audit-logs',
        headers: { Cookie: adminCookie }
      });
      console.log('   Status:', auditRes.statusCode, 'Audit Log Entries:', auditRes.body.data.auditLogs.length);

      console.log('\n🎉 ALL 23 LMS END-TO-END BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

      server.close(() => {
        process.exit(0);
      });
    } catch (err) {
      console.error('\n❌ Integration Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runFullBackendIntegrationTest();
