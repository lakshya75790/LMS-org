const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const TrainingAssignment = require('./models/TrainingAssignment');
const AutoAssignmentRule = require('./models/AutoAssignmentRule');

function makeRequest({ method, path, headers = {}, body = null, port = 5022 }) {
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

async function runAutoAssignmentReactivationLifecycleE2ETest() {
  console.log('🚀 Running E2E Verification for Auto Assignment Rule Reactivation & Life-Cycle Flow...\n');

  await connectDB();

  const server = app.listen(5022, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `react_admin_${ts}@test.com`;
      const instEmail = `react_inst_${ts}@test.com`;
      const emp1Email = `react_harshita_${ts}@test.com`;
      const emp2Email = `react_lakshya_${ts}@test.com`;
      const emp3Email = `react_aman_${ts}@test.com`;
      const emp4Email = `react_rohan_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Reactivation Org ${ts}`,
          orgCode: `RO${ts.toString().slice(-4)}`,
          adminName: 'Reactivation Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Register Instructor & Initial 2 Employees (Harshita, Lakshya)
      console.log('\n2. Registering Instructor & Initial 2 Employees...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Organizational Ethics' }
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

      const e1Reg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Harshita Paliwal', email: emp1Email, password: 'Password123', orgCode } });
      const emp1Id = e1Reg.body.data.user._id;
      const emp1Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp1Email, password: 'Password123' } });
      const emp1Cookie = emp1Login.cookie;

      const e2Reg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Lakshya Joshi', email: emp2Email, password: 'Password123', orgCode } });
      const emp2Id = e2Reg.body.data.user._id;

      // 3. Instructor Creates Training Course
      console.log('\n3. Creating Course "Professional Communication & Workplace Skills"...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Professional Communication & Workplace Skills',
          description: 'Ethics and communication',
          categoryId: catId,
          status: 'published',
          sections: [{ title: 'Sec 1', lectures: [{ title: 'L1', description: 'desc', videoUrl: 'https://cdn.example.com/v1.mp4' }] }]
        }
      });
      const training = courseRes.body.data.training;
      const sub1Id = training.sections[0].subSections[0]._id;

      // 4. CASE 1 — Admin Configures Active Auto Assignment Rule
      console.log('\n4. [CASE 1] Admin Creating Active Auto-Assignment Rule...');
      const ruleRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/auto-rule',
        headers: { Cookie: adminCookie },
        body: { trainingId: training._id, customDeadlineDays: 30 }
      });
      const ruleId = ruleRes.body.data.rule._id;

      const hAssignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: emp1Cookie } });
      const hAssignId = hAssignRes.body.data.assignments[0]._id;

      console.log('   Auto Rule Created. Status:', ruleRes.body.data.rule.status);
      console.log('   Assigned to Harshita & Lakshya. Initial assignments count for Harshita:', hAssignRes.body.data.assignments.length);

      // 5. Harshita Completes Training
      console.log('\n5. Harshita Completing Training Course (Status -> Completed)...');
      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: emp1Cookie },
        body: { trainingAssignmentId: hAssignId, subSectionId: sub1Id }
      });

      const hCompletedDoc = await TrainingAssignment.findById(hAssignId);
      console.log('   Harshita Status:', hCompletedDoc.status, 'Progress:', hCompletedDoc.progressPercentage);
      if (hCompletedDoc.status !== 'Completed') throw new Error('Harshita failed to complete training!');

      // 6. CASE 2 — Admin Deactivates Auto Rule
      console.log('\n6. [CASE 2] Admin Deactivating Auto-Assignment Rule...');
      const deactRes = await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/auto-rules/${ruleId}/deactivate`,
        headers: { Cookie: adminCookie }
      });
      console.log('   Deactivate API Status:', deactRes.statusCode, 'Rule Status:', deactRes.body.data.rule.status);

      // Verify existing assignments remain untouched
      const hAfterDeact = await TrainingAssignment.findById(hAssignId);
      console.log('   Harshita Status after Deactivation (Should remain Completed):', hAfterDeact.status);
      if (hAfterDeact.status !== 'Completed') throw new Error('Deactivating rule affected existing completed assignment!');

      // 7. CASE 8 — Register Future Employee (Aman) while rule is DEACTIVATED
      console.log('\n7. [CASE 8] Registering Employee Aman while Rule is DEACTIVATED...');
      const e3Reg = await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Aman Kumar', email: emp3Email, password: 'Password123', orgCode } });
      const emp3Id = e3Reg.body.data.user._id;
      const emp3Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp3Email, password: 'Password123' } });
      const emp3Cookie = emp3Login.cookie;

      const aAssignmentsBeforeReact = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: emp3Cookie } });
      console.log('   Aman Assignments while rule deactivated (Should be 0):', aAssignmentsBeforeReact.body.data.assignments.length);
      if (aAssignmentsBeforeReact.body.data.assignments.length !== 0) {
        throw new Error('Deactivated rule automatically assigned training to new employee!');
      }

      // 8. CASE 3, 4, 5, 6 — Reactivate Rule & Verify Duplicate Prevention
      console.log('\n8. [CASE 3, 4, 5, 6] Admin Reactivating Auto-Assignment Rule...');
      const reactRes = await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/auto-rules/${ruleId}/reactivate`,
        headers: { Cookie: adminCookie }
      });
      console.log('   Reactivate API Status:', reactRes.statusCode, 'Rule Status:', reactRes.body.data.rule.status);

      // Check Harshita's assignments count and status
      const hAfterReactList = await TrainingAssignment.find({ employeeId: emp1Id, trainingId: training._id });
      console.log('   Harshita Assignments Count after Reactivation (Should be 1):', hAfterReactList.length);
      console.log('   Harshita Status after Reactivation (Should remain Completed):', hAfterReactList[0].status);

      if (hAfterReactList.length !== 1 || hAfterReactList[0].status !== 'Completed') {
        throw new Error('Reactivation created duplicate assignment or reset completed status for Harshita!');
      }

      // Check Aman's assignment (who previously had no assignment)
      const aAssignmentsAfterReact = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: emp3Cookie } });
      console.log('   Aman Assignments after Reactivation (Should be 1):', aAssignmentsAfterReact.body.data.assignments.length);
      if (aAssignmentsAfterReact.body.data.assignments.length !== 1) {
        throw new Error('Reactivation failed to assign training to eligible employee without assignment!');
      }

      // 9. CASE 7 — Register Future Employee (Rohan) while rule is ACTIVE
      console.log('\n9. [CASE 7] Registering Employee Rohan while Rule is ACTIVE...');
      await makeRequest({ method: 'POST', path: '/api/auth/register-employee', body: { name: 'Rohan Sharma', email: emp4Email, password: 'Password123', orgCode } });
      const emp4Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp4Email, password: 'Password123' } });
      const emp4Cookie = emp4Login.cookie;

      const rAssignments = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: emp4Cookie } });
      console.log('   Rohan Assignments while rule active (Should be 1):', rAssignments.body.data.assignments.length);

      if (rAssignments.body.data.assignments.length !== 1) {
        throw new Error('Active auto-assignment rule failed to assign training to new employee Rohan!');
      }

      console.log('\n🎉 AUTO ASSIGNMENT RULE REACTIVATION LIFECYCLE E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runAutoAssignmentReactivationLifecycleE2ETest();
