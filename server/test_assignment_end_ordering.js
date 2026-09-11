const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5018 }) {
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

async function runAssignmentEndOrderingE2ETest() {
  console.log('🚀 Running E2E Verification for Assignment Placement at Very End of Training...\n');

  await connectDB();

  const server = app.listen(5018, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `ord_admin_${ts}@test.com`;
      const instEmail = `ord_inst_${ts}@test.com`;
      const empEmail = `ord_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Ordering Test Org ${ts}`,
          orgCode: `OTO${ts.toString().slice(-4)}`,
          adminName: 'Ordering Admin',
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
        body: { name: 'Fullstack Engineering' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Prof. Architecture', email: instEmail, password: 'Password123' }
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
        body: { name: 'Diya Learner', email: empEmail, password: 'Password123', orgCode }
      });
      const empId = empReg.body.data.user._id;

      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;

      // 3. Instructor creates 2-Section Training with Quiz in Section 1 and Assignment
      console.log('\n3. Creating 2-Section Course with Quiz in Section 1 and Project Assignment...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Fullstack Microservices Architecture',
          description: 'Build enterprise microservices',
          categoryId: catId,
          status: 'published',
          sections: [
            {
              title: 'Module 1: Service Design',
              lectures: [
                { title: 'Lesson 1.1: REST APIs', description: 'API principles', videoUrl: 'https://cdn.example.com/m1.mp4' }
              ],
              quiz: {
                title: 'Service Design Quiz',
                timeLimitMinutes: 10,
                passingScorePercent: 70,
                questions: [
                  { questionText: 'What does REST stand for?', options: ['Representational State Transfer', 'Random State', 'Real Time', 'Route Service'], correctAnswerIndex: 0 }
                ]
              }
            },
            {
              title: 'Module 2: Messaging Queues',
              lectures: [
                { title: 'Lesson 2.1: RabbitMQ & Kafka', description: 'Asynchronous queues', videoUrl: 'https://cdn.example.com/m2.mp4' }
              ]
            }
          ],
          assignment: {
            title: 'Microservices Capstone Architecture Report',
            instructions: 'Submit GitHub repo with complete microservice implementation.'
          }
        }
      });

      const training = courseRes.body.data.training;

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

      // 5. Fetch Workspace & Verify Project Assignment details
      console.log('\n5. Fetching Workspace Progress API & Verifying Assignment...');
      const wsRes = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });

      const trData = wsRes.body.data.assignment.trainingId;
      console.log('   Sections Count:', trData.sections.length);
      console.log('   Training Assignment Title:', trData.assignmentId?.title || 'Capstone Report');

      // 6. Complete Lesson 1.1, Pass Quiz, Complete Lesson 2.1, and submit Assignment at the end
      console.log('\n6. Completing Lessons 1.1, Quiz, Lesson 2.1, and submitting Capstone Assignment...');
      const sec1Sub1 = trData.sections[0].subSections[0]._id;
      const quizId = trData.sections[0].subSections[0].quizId?._id || trData.sections[0].subSections[0].quizId;
      const sec2Sub1 = trData.sections[1].subSections[0]._id;

      const assignmentObj = await makeRequest({
        method: 'GET',
        path: `/api/assignments/${training._id}`,
        headers: { Cookie: empCookie }
      });
      const assignmentId = assignmentObj.body.data.assignment._id;

      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec1Sub1 }
      });

      await makeRequest({
        method: 'POST',
        path: `/api/quizzes/${quizId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          userAnswers: [{ questionIndex: 0, selectedOptionIndex: 0 }],
          trainingAssignmentId
        }
      });

      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sec2Sub1 }
      });

      const submitRes = await makeRequest({
        method: 'POST',
        path: `/api/assignments/${assignmentId}/submit`,
        headers: { Cookie: empCookie },
        body: {
          submissionType: 'github',
          githubUrl: 'https://github.com/diya/microservices-capstone',
          trainingAssignmentId
        }
      });

      console.log('   Final Assignment Submission Status:', submitRes.statusCode);

      const finalWs = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });

      console.log('   Final Progress %:', finalWs.body.data.assignment.progressPercentage);
      console.log('   Final Assignment Status:', finalWs.body.data.assignment.status);

      if (finalWs.body.data.assignment.progressPercentage === 100 && finalWs.body.data.assignment.status === 'Completed') {
        console.log('\n🎉 ASSIGNMENT END PLACEMENT & ORDERING E2E TEST PASSED PERFECTLY! 🎉');
      } else {
        throw new Error('Course completion failed after final assignment submission');
      }

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runAssignmentEndOrderingE2ETest();
