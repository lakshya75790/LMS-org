const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const AssignmentSubmission = require('./models/AssignmentSubmission');

function makeRequest({ method, path, headers = {}, body = null, port = 5019 }) {
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

async function runInstructorAssignmentSubmissionAndReviewE2ETest() {
  console.log('🚀 Running E2E Verification for Employee Assignment Submission -> Instructor Review & Grading -> Employee Feedback View...\n');

  await connectDB();

  const server = app.listen(5019, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `sub_admin_${ts}@test.com`;
      const instEmail = `sub_inst_${ts}@test.com`;
      const empEmail = `sub_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Submissions Review Org ${ts}`,
          orgCode: `SRO${ts.toString().slice(-4)}`,
          adminName: 'Submission Admin',
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
        body: { name: 'Leadership & Soft Skills' }
      });
      const catId = catRes.body.data.category._id;

      const instReg = await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Senior Instructor', email: instEmail, password: 'Password123' }
      });
      const instId = instReg.body.data.instructor._id;

      const instLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail, password: 'Password123' }
      });
      const instCookie = instLogin.cookie;

      const empReg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Harshita Paliwal', email: empEmail, password: 'Password123', orgCode }
      });
      const empId = empReg.body.data.user._id;

      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;

      // 3. Instructor creates Course with Project Assignment
      console.log('\n3. Creating Course "Professional Communication & Workplace Skills"...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Professional Communication & Workplace Skills',
          description: 'Master teamwork and active listening',
          categoryId: catId,
          status: 'published',
          sections: [
            {
              title: 'Module 1: Teamwork',
              lectures: [
                { title: 'Lesson 1.1: Collaboration Basics', description: 'Working together', videoUrl: 'https://cdn.example.com/v1.mp4' }
              ]
            }
          ],
          assignment: {
            title: 'Teamwork & Collaboration',
            instructions: 'Submit GitHub repository link for team communication simulation.'
          }
        }
      });

      const training = courseRes.body.data.training;

      // 4. Admin assigns course to Employee
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

      // 5. Employee Submits Assignment with GitHub URL
      console.log('\n5. Employee Harshita Submitting GitHub Repository Assignment...');
      const githubUrl = 'https://github.com/harshitap/teamwork-collaboration-project';
      const submitRes = await makeRequest({
        method: 'POST',
        path: `/api/assignments/${training._id}/submit`,
        headers: { Cookie: empCookie },
        body: {
          submissionType: 'github',
          githubUrl,
          trainingAssignmentId
        }
      });

      console.log('   Submission Status:', submitRes.statusCode);
      const submissionId = submitRes.body.data.submission._id;

      // Check MongoDB
      const dbSub = await AssignmentSubmission.findById(submissionId);
      console.log('   MongoDB Check -> status:', dbSub.status, 'githubUrl:', dbSub.githubUrl);

      // 6. Instructor Fetches Submissions
      console.log('\n6. Instructor Fetching Submissions via GET /api/assignments/instructor-submissions...');
      const instSubRes = await makeRequest({
        method: 'GET',
        path: `/api/assignments/instructor-submissions?trainingId=${training._id}`,
        headers: { Cookie: instCookie }
      });

      const instSubData = instSubRes.body.data;
      console.log('   Total Submissions:', instSubData.stats.totalSubmissions);
      console.log('   Pending Reviews:', instSubData.stats.pendingReviews);
      console.log('   Reviewed Count:', instSubData.stats.reviewedCount);

      if (instSubData.submissions.length === 0) {
        throw new Error('Instructor API returned zero submissions for training!');
      }

      const subObj = instSubData.submissions[0];
      console.log('   Found Employee Name:', subObj.employeeId?.name);
      console.log('   Found Assignment Title:', subObj.assignmentId?.title);
      console.log('   Found GitHub URL:', subObj.githubUrl);

      if (subObj.employeeId?.name !== 'Harshita Paliwal' || subObj.githubUrl !== githubUrl) {
        throw new Error('Retrieved submission data does not match submitted employee or repository!');
      }

      // 7. Instructor Reviews Submission with Qualitative Grade "Good" & Feedback
      console.log('\n7. Instructor Evaluating & Grading Submission ("Good")...');
      const feedbackText = 'Good implementation and clear approach. A few improvements are needed in code structure and error handling.';

      const reviewRes = await makeRequest({
        method: 'PUT',
        path: `/api/assignments/submissions/${submissionId}/review`,
        headers: { Cookie: instCookie },
        body: {
          grade: 'Good',
          feedback: feedbackText
        }
      });

      console.log('   Review API Status:', reviewRes.statusCode);

      // Verify MongoDB after review
      const dbReviewedSub = await AssignmentSubmission.findById(submissionId);
      console.log('   MongoDB Check After Review -> status:', dbReviewedSub.status, 'grade:', dbReviewedSub.grade);
      console.log('   Reviewed By ID:', dbReviewedSub.reviewedBy.toString());

      if (dbReviewedSub.status !== 'reviewed' || dbReviewedSub.grade !== 'Good' || dbReviewedSub.reviewedBy.toString() !== instId.toString()) {
        throw new Error('MongoDB document was not properly updated with status, grade, and reviewedBy!');
      }

      // 8. Re-fetch Instructor Submissions & Check Stats
      console.log('\n8. Instructor Re-fetching Submissions Stats...');
      const reFetchRes = await makeRequest({
        method: 'GET',
        path: `/api/assignments/instructor-submissions?trainingId=${training._id}`,
        headers: { Cookie: instCookie }
      });
      console.log('   Updated Pending Reviews:', reFetchRes.body.data.stats.pendingReviews);
      console.log('   Updated Reviewed Count:', reFetchRes.body.data.stats.reviewedCount);

      if (reFetchRes.body.data.stats.pendingReviews !== 0 || reFetchRes.body.data.stats.reviewedCount !== 1) {
        throw new Error('Instructor stats did not update after reviewing submission!');
      }

      // 9. Employee Views Reviewed Assignment
      console.log('\n9. Employee Fetching Assignment Details & Verifying Review Result...');
      const empGetSub = await makeRequest({
        method: 'GET',
        path: `/api/assignments/${training._id}`,
        headers: { Cookie: empCookie }
      });

      const empUserSub = empGetSub.body.data.userSubmission;
      console.log('   Employee View Status:', empUserSub.status);
      console.log('   Employee View Grade:', empUserSub.grade);
      console.log('   Employee View Feedback:', empUserSub.feedback);

      if (empUserSub.status !== 'reviewed' || empUserSub.grade !== 'Good' || empUserSub.feedback !== feedbackText) {
        throw new Error('Employee assignment details view did not return updated grade and feedback!');
      }

      console.log('\n🎉 INSTRUCTOR ASSIGNMENT SUBMISSION & REVIEW E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runInstructorAssignmentSubmissionAndReviewE2ETest();
