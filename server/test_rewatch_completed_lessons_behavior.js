const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const TrainingProgress = require('./models/TrainingProgress');

function makeRequest({ method, path, headers = {}, body = null, port = 5017 }) {
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

async function runRewatchCompletedLessonsE2ETest() {
  console.log('🚀 Running E2E Verification for Rewatching Completed Lessons & Progress Persistence...\n');

  await connectDB();

  const server = app.listen(5017, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `rw_admin_${ts}@test.com`;
      const instEmail = `rw_inst_${ts}@test.com`;
      const empEmail = `rw_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Rewatch Test Org ${ts}`,
          orgCode: `RWT${ts.toString().slice(-4)}`,
          adminName: 'Rewatch Admin',
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
        body: { name: 'Technical Skills' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Tech Instructor', email: instEmail, password: 'Password123' }
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
        body: { name: 'Rohan Rewatcher', email: empEmail, password: 'Password123', orgCode }
      });
      const empId = empReg.body.data.user._id;

      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;

      // 3. Instructor creates Course with 3 Video Lessons
      console.log('\n3. Creating Course with 3 Video Lessons...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Advanced React Architecture',
          description: 'Master enterprise React patterns',
          categoryId: catId,
          status: 'published',
          sections: [
            {
              title: 'Section 1: Core Fundamentals',
              lectures: [
                { title: 'Video 1: State Management', description: 'Deep dive state', videoUrl: 'https://cdn.example.com/v1.mp4' },
                { title: 'Video 2: Custom Hooks', description: 'Creating hooks', videoUrl: 'https://cdn.example.com/v2.mp4' },
                { title: 'Video 3: Performance Tuning', description: 'Optimization', videoUrl: 'https://cdn.example.com/v3.mp4' }
              ]
            }
          ]
        }
      });

      const training = courseRes.body.data.training;
      const sub1 = training.sections[0].subSections[0]._id;
      const sub2 = training.sections[0].subSections[1]._id;
      const sub3 = training.sections[0].subSections[2]._id;

      // 4. Assign training to Employee
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

      // 5. Sequential Initial Completion of Video 1, 2, 3
      console.log('\n5. Completing Video 1, Video 2, Video 3...');
      const c1 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sub1 }
      });
      console.log('   Video 1 Complete -> Progress %:', c1.body.data.percentage);

      const c2 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sub2 }
      });
      console.log('   Video 2 Complete -> Progress %:', c2.body.data.percentage);

      const c3 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sub3 }
      });
      console.log('   Video 3 Complete -> Progress %:', c3.body.data.percentage, 'Status:', c3.body.data.assignmentStatus);

      if (c3.body.data.percentage !== 100 || c3.body.data.assignmentStatus !== 'Completed') {
        throw new Error('Course failed to reach 100% Completed on initial completion!');
      }

      // 6. Rewatch Test: Re-open Video 1 and trigger complete API again
      console.log('\n6. Rewatching Video 1 & triggering completion API again...');
      const rw1 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sub1 }
      });

      console.log('   Progress % after rewatching Video 1:', rw1.body.data.percentage);
      console.log('   Assignment Status:', rw1.body.data.assignmentStatus);

      // Verify MongoDB document has NO duplicate entries in completedSubSectionIds
      const dbProgress = await TrainingProgress.findOne({ trainingAssignmentId });
      console.log('   Completed SubSection IDs count in MongoDB:', dbProgress.completedSubSectionIds.length);

      if (dbProgress.completedSubSectionIds.length !== 3) {
        throw new Error('Rewatching created duplicate completion IDs in MongoDB!');
      }
      if (rw1.body.data.percentage !== 100) {
        throw new Error('Rewatching Video 1 reduced progress percentage below 100%!');
      }

      // 7. Rewatch Test: Re-open Video 2 and trigger complete API again
      console.log('\n7. Rewatching Video 2...');
      const rw2 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId, subSectionId: sub2 }
      });

      if (rw2.body.data.percentage !== 100) {
        throw new Error('Rewatching Video 2 reduced progress percentage below 100%!');
      }

      // 8. Fetch Workspace Progress API
      console.log('\n8. Fetching Workspace Progress API for Completed Course...');
      const wsRes = await makeRequest({
        method: 'GET',
        path: `/api/progress/${trainingAssignmentId}`,
        headers: { Cookie: empCookie }
      });

      const completedSubIds = wsRes.body.data.progress.completedSubSectionIds.map(id => id.toString());
      console.log('   Completed SubSection IDs from API:', completedSubIds.length);
      console.log('   Video 1 Completed:', completedSubIds.includes(sub1.toString()));
      console.log('   Video 2 Completed:', completedSubIds.includes(sub2.toString()));
      console.log('   Video 3 Completed:', completedSubIds.includes(sub3.toString()));

      if (!completedSubIds.includes(sub1.toString()) || !completedSubIds.includes(sub2.toString()) || !completedSubIds.includes(sub3.toString())) {
        throw new Error('One or more completed videos lost their completion status after rewatching!');
      }

      console.log('\n🎉 REWATCH COMPLETED LESSONS & PROGRESS PERSISTENCE E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runRewatchCompletedLessonsE2ETest();
