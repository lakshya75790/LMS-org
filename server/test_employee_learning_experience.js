const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5014 }) {
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

async function runEmployeeLearningE2ETest() {
  console.log('🚀 Running E2E Verification for Employee Learning Experience & Real Backend Data...\n');

  await connectDB();

  const server = app.listen(5014, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `emp_admin_${ts}@test.com`;
      const instEmail = `emp_inst_${ts}@test.com`;
      const empEmail = `emp_learner_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Learning Experience Org ${ts}`,
          orgCode: `LEO${ts.toString().slice(-4)}`,
          adminName: 'LE Admin',
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
        body: { name: 'Full Stack Learning' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Lead Instructor', email: instEmail, password: 'Password123' }
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
        body: { name: 'Learner Employee', email: empEmail, password: 'Password123', orgCode }
      });
      const empId = empReg.body.data.user._id;

      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;

      // 3. Instructor creates Course with Sections, Quiz, and Assignment
      console.log('\n3. Instructor creating course with Sections, Quiz, & Assignment...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Full Stack React & Node Mastery',
          description: 'Complete hands-on LMS course',
          categoryId: catId,
          status: 'published',
          sections: [
            {
              title: 'Section 1: Modern React',
              lectures: [
                { title: 'Lesson 1.1: Virtual DOM & JSX', description: 'Overview', videoUrl: 'https://cdn.example.com/v1.mp4' },
                { title: 'Lesson 1.2: State & Props', description: 'State management', videoUrl: 'https://cdn.example.com/v2.mp4' }
              ],
              quiz: {
                title: 'Section 1 MCQ Quiz',
                timeLimitMinutes: 15,
                passingScorePercent: 70,
                questions: [
                  { questionText: 'What is JSX?', options: ['Syntax extension', 'Database', 'CSS', 'Protocol'], correctAnswerIndex: 0 },
                  { questionText: 'What is useState?', options: ['Component', 'React Hook', 'File', 'Package'], correctAnswerIndex: 1 }
                ]
              }
            },
            {
              title: 'Section 2: Practical Application',
              lectures: [
                { title: 'Lesson 2.1: Node & Express Backend', description: 'API Development', videoUrl: 'https://cdn.example.com/v3.mp4' }
              ]
            }
          ],
          assignment: {
            title: 'Build Todo App',
            instructions: 'Create a full stack application.'
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
      console.log('   Training Assignment ID:', trainingAssignmentId);

      // 5. Employee fetches Progress
      console.log('\n5. Employee fetching progress workspace...');
      let progRes = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });
      console.log('   Initial Progress %:', progRes.body.data.progress.progressPercentage);

      // 6. Employee completes Lesson 1.1 (Succeeds independently of quiz)
      console.log('\n6. Employee completing Lesson 1.1...');
      const comp1Pass = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec1Sub1._id }
      });
      console.log('   Progress % after Lesson 1.1:', comp1Pass.body.data.percentage);

      // 7. Employee completes Lesson 1.2
      console.log('\n7. Employee completing Lesson 1.2...');
      const comp2Pass = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec1Sub2._id }
      });
      console.log('   Progress % after Lesson 1.2:', comp2Pass.body.data.percentage);

      // 8. Employee attempts Quiz (fails first attempt: 50%)
      console.log('\n8. Employee attempting Quiz (Failing Attempt: 50%)...');
      const quizFail = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 0 }, // Correct
            { questionIndex: 1, selectedOptionIndex: 0 }  // Incorrect
          ],
          trainingAssignmentId
        }
      });
      console.log('   Quiz Fail Attempt Passed:', quizFail.body.data.passed, '| Score:', quizFail.body.data.percentage + '%');

      // 9. Employee retakes Quiz (Passing Attempt: 100%)
      console.log('\n9. Employee retaking Quiz (Passing Attempt: 100%)...');
      const quizPass = await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          userAnswers: [
            { questionIndex: 0, selectedOptionIndex: 0 }, // Correct
            { questionIndex: 1, selectedOptionIndex: 1 }  // Correct
          ],
          trainingAssignmentId
        }
      });
      console.log('   Quiz Retake Passed:', quizPass.body.data.passed, '| Score:', quizPass.body.data.percentage + '%');

      // 10. Complete Lesson 2.1
      console.log('\n10. Employee completing Lesson 2.1...');
      const comp3Pass = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec2Sub1._id }
      });
      console.log('   Progress % after Lesson 2.1:', comp3Pass.body.data.percentage);

      // 11. Employee submits Project Assignment with GitHub link
      console.log('\n11. Employee submitting Project Assignment (GitHub URL)...');
      const assignSub = await makeRequest({
        method: 'POST',
        path: `/api/assignments/${assignmentId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          submissionType: 'github',
          githubUrl: 'https://github.com/learner/todo-lms-app',
          trainingAssignmentId
        }
      });
      console.log('   Assignment Submit Status:', assignSub.statusCode, '| Submission Status:', assignSub.body.data.submission.status);

      // 12. Check Final Progress (Reaches 100%)
      console.log('\n12. Fetching Final Workspace Progress...');
      let finalProgRes = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });
      console.log('    Final Progress %:', finalProgRes.body.data.assignment.progressPercentage);
      console.log('    Final Assignment Status:', finalProgRes.body.data.assignment.status);

      // 13. Verification on Instructor Side
      console.log('\n13. Verifying Assignment Submission on Instructor Dashboard...');
      const instSubCheck = await makeRequest({
        method: 'GET',
        path: `/api/assignments/${assignmentId}/submissions`,
        headers: { Cookie: instCookie }
      });
      console.log('    Submissions count on Instructor side:', instSubCheck.body.data.submissions.length);
      console.log('    Employee Name:', instSubCheck.body.data.submissions[0]?.employeeId?.name);
      console.log('    GitHub URL:', instSubCheck.body.data.submissions[0]?.githubUrl);

      if (
        finalProgRes.body.data.assignment.progressPercentage === 100 &&
        finalProgRes.body.data.assignment.status === 'Completed' &&
        instSubCheck.body.data.submissions.length === 1
      ) {
        console.log('\n🎉 EMPLOYEE LEARNING EXPERIENCE E2E TEST PASSED PERFECTLY! 🎉');
      } else {
        throw new Error('Employee learning experience E2E verification failed');
      }

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runEmployeeLearningE2ETest();
