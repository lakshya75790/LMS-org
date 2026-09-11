const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5021 }) {
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

async function runEmployeeFeedbackFeatureE2ETest() {
  console.log('🚀 Running E2E Verification for Employee Feedback Feature...\n');

  await connectDB();

  const server = app.listen(5021, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `fb_admin_${ts}@test.com`;
      const instEmail = `fb_inst_${ts}@test.com`;
      const emp1Email = `fb_harshita_${ts}@test.com`;
      const emp2Email = `fb_lakshya_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Feedback Test Org ${ts}`,
          orgCode: `FTO${ts.toString().slice(-4)}`,
          adminName: 'Feedback Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Register Instructor & 2 Employees (Harshita, Lakshya)
      console.log('\n2. Registering Instructor & 2 Employees (Harshita, Lakshya)...');
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

      const e1Reg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Harshita Paliwal', email: emp1Email, password: 'Password123', orgCode }
      });
      const emp1Id = e1Reg.body.data.user._id;
      const emp1Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp1Email, password: 'Password123' } });
      const emp1Cookie = emp1Login.cookie;

      const e2Reg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Lakshya Joshi', email: emp2Email, password: 'Password123', orgCode }
      });
      const emp2Id = e2Reg.body.data.user._id;
      const emp2Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp2Email, password: 'Password123' } });
      const emp2Cookie = emp2Login.cookie;

      // 3. Instructor Creates 2 Courses
      console.log('\n3. Instructor Creating 2 Courses with Assignments...');
      const c1Res = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Professional Communication & Workplace Skills',
          description: 'Teamwork skills',
          categoryId: catId,
          status: 'published',
          sections: [{ title: 'Sec 1', lectures: [{ title: 'L1', description: 'desc', videoUrl: 'https://cdn.example.com/v1.mp4' }] }],
          assignment: { title: 'Workplace Collaboration Task', instructions: 'Submit repo' }
        }
      });
      const tr1 = c1Res.body.data.training;

      const c2Res = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Advanced Microservices Design',
          description: 'Node.js Microservices',
          categoryId: catId,
          status: 'published',
          sections: [{ title: 'Sec 1', lectures: [{ title: 'L1', description: 'desc', videoUrl: 'https://cdn.example.com/v2.mp4' }] }],
          assignment: { title: 'Microservices Capstone Repo', instructions: 'Submit GitHub URL' }
        }
      });
      const tr2 = c2Res.body.data.training;

      // 4. Assign Trainings
      console.log('\n4. Assigning Trainings...');
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: { assignmentType: 'specific', trainingId: tr1._id, employeeIds: [emp1Id, emp2Id] }
      });
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: { assignmentType: 'specific', trainingId: tr2._id, employeeIds: [emp1Id] }
      });

      // 5. Harshita Submits Both Assignments
      console.log('\n5. Harshita Submitting Both Assignments...');
      const s1Res = await makeRequest({
        method: 'POST',
        path: `/api/assignments/${tr1._id}/submit`,
        headers: { Cookie: emp1Cookie },
        body: { submissionType: 'github', githubUrl: 'https://github.com/harshita/workplace-task' }
      });
      const sub1Id = s1Res.body.data.submission._id;

      const s2Res = await makeRequest({
        method: 'POST',
        path: `/api/assignments/${tr2._id}/submit`,
        headers: { Cookie: emp1Cookie },
        body: { submissionType: 'github', githubUrl: 'https://github.com/harshita/microservices-capstone' }
      });
      const sub2Id = s2Res.body.data.submission._id;

      // 6. Check Feedback for Harshita BEFORE Instructor Review (Should be empty!)
      console.log('\n6. Checking Harshita Feedback API before instructor review...');
      const preReviewFeedback = await makeRequest({
        method: 'GET',
        path: '/api/assignments/my-feedback',
        headers: { Cookie: emp1Cookie }
      });
      console.log('   Feedback items count (Should be 0):', preReviewFeedback.body.data.submissions.length);
      if (preReviewFeedback.body.data.submissions.length !== 0) {
        throw new Error('Unreviewed pending submissions appeared in Feedback API!');
      }

      // 7. Instructor Reviews Assignment 1 (Good) & Assignment 2 (Excellent)
      console.log('\n7. Instructor Reviewing Submissions for Harshita...');
      await makeRequest({
        method: 'PUT',
        path: `/api/assignments/submissions/${sub1Id}/review`,
        headers: { Cookie: instCookie },
        body: {
          grade: 'Good',
          feedback: 'Good implementation and clear approach. The overall solution is well structured, but a few improvements can be made in code structure.'
        }
      });

      await makeRequest({
        method: 'PUT',
        path: `/api/assignments/submissions/${sub2Id}/review`,
        headers: { Cookie: instCookie },
        body: {
          grade: 'Excellent',
          feedback: 'Outstanding work and clean modular architecture! Excellent error handling and test coverage.'
        }
      });

      // 8. Harshita Fetches Feedback API after reviews
      console.log('\n8. Harshita Fetching GET /api/assignments/my-feedback...');
      const postReviewFeedback = await makeRequest({
        method: 'GET',
        path: '/api/assignments/my-feedback',
        headers: { Cookie: emp1Cookie }
      });

      const fbItems = postReviewFeedback.body.data.submissions;
      console.log('   Reviewed Feedback Count:', fbItems.length);

      if (fbItems.length !== 2) {
        throw new Error('Harshita Feedback API failed to return 2 reviewed submissions!');
      }

      console.log('   Item 1 Grade:', fbItems[0].grade, 'Training:', fbItems[0].assignmentId?.trainingId?.title);
      console.log('   Item 1 Feedback:', fbItems[0].feedback);
      console.log('   Item 2 Grade:', fbItems[1].grade, 'Training:', fbItems[1].assignmentId?.trainingId?.title);
      console.log('   Item 2 Feedback:', fbItems[1].feedback);

      if (!fbItems.some(i => i.grade === 'Good') || !fbItems.some(i => i.grade === 'Excellent')) {
        throw new Error('Retrieved grades do not match instructor evaluations!');
      }

      // 9. Security Isolation Check: Lakshya fetches feedback
      console.log('\n9. Security Isolation Check: Lakshya fetching GET /api/assignments/my-feedback...');
      const lakshyaFeedback = await makeRequest({
        method: 'GET',
        path: '/api/assignments/my-feedback',
        headers: { Cookie: emp2Cookie }
      });
      console.log('   Lakshya Feedback Count (Should be 0):', lakshyaFeedback.body.data.submissions.length);

      if (lakshyaFeedback.body.data.submissions.length !== 0) {
        throw new Error('Employee Lakshya was able to access Harshita\'s feedback!');
      }

      console.log('\n🎉 EMPLOYEE FEEDBACK FEATURE E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runEmployeeFeedbackFeatureE2ETest();
