const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const TrainingAssignment = require('./models/TrainingAssignment');

function makeRequest({ method, path, headers = {}, body = null, port = 5020 }) {
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

async function runOverdueAndLockControlsE2ETest() {
  console.log('🚀 Running E2E Verification for Instructor Overdue & Per-Employee Lock Controls...\n');

  await connectDB();

  const server = app.listen(5020, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `lc_admin_${ts}@test.com`;
      const instEmail = `lc_inst_${ts}@test.com`;
      const emp1Email = `lc_harshita_${ts}@test.com`;
      const emp2Email = `lc_lakshya_${ts}@test.com`;
      const emp3Email = `lc_aman_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Lock Control Org ${ts}`,
          orgCode: `LCO${ts.toString().slice(-4)}`,
          adminName: 'Lock Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Register Instructor & 3 Employees
      console.log('\n2. Registering Instructor & 3 Employees (Harshita, Lakshya, Aman)...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Workplace Skills' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Master Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail, password: 'Password123' }
      });
      const instCookie = instLogin.cookie;

      // Employee 1: Harshita
      const e1Reg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Harshita Paliwal', email: emp1Email, password: 'Password123', orgCode }
      });
      const emp1Id = e1Reg.body.data.user._id;
      const emp1Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp1Email, password: 'Password123' } });
      const emp1Cookie = emp1Login.cookie;

      // Employee 2: Lakshya
      const e2Reg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Lakshya Joshi', email: emp2Email, password: 'Password123', orgCode }
      });
      const emp2Id = e2Reg.body.data.user._id;
      const emp2Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp2Email, password: 'Password123' } });
      const emp2Cookie = emp2Login.cookie;

      // Employee 3: Aman
      const e3Reg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Aman Kumar', email: emp3Email, password: 'Password123', orgCode }
      });
      const emp3Id = e3Reg.body.data.user._id;
      const emp3Login = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: emp3Email, password: 'Password123' } });
      const emp3Cookie = emp3Login.cookie;

      // 3. Instructor creates Training
      console.log('\n3. Instructor Creating Course "Professional Communication & Workplace Skills"...');
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
              title: 'Section 1',
              lectures: [
                { title: 'Lesson 1.1', description: 'Basics', videoUrl: 'https://cdn.example.com/l1.mp4' }
              ]
            }
          ]
        }
      });
      const training = courseRes.body.data.training;
      const sub1Id = training.sections[0].subSections[0]._id;

      // 4. Assign training to all 3 employees
      console.log('\n4. Assigning Training to Harshita, Lakshya, and Aman...');
      await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: {
          assignmentType: 'specific',
          trainingId: training._id,
          employeeIds: [emp1Id, emp2Id, emp3Id]
        }
      });

      // Get individual assignment IDs
      const hAssignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: emp1Cookie } });
      const hAssignId = hAssignRes.body.data.assignments[0]._id;

      const lAssignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: emp2Cookie } });
      const lAssignId = lAssignRes.body.data.assignments[0]._id;

      const aAssignRes = await makeRequest({ method: 'GET', path: '/api/assignments-engine/my-assignments', headers: { Cookie: emp3Cookie } });
      const aAssignId = aAssignRes.body.data.assignments[0]._id;

      // 5. CASE 1: Harshita completes training -> Verify NO actions allowed for Completed
      console.log('\n5. [CASE 1] Harshita completes training (100%)...');
      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: emp1Cookie },
        body: { trainingAssignmentId: hAssignId, subSectionId: sub1Id }
      });

      const hDoc = await TrainingAssignment.findById(hAssignId);
      console.log('   Harshita Status:', hDoc.status, 'Progress:', hDoc.progressPercentage);

      // Verify Backend rejects Extend Deadline, Lock, and Unlock for Completed Harshita
      const badExtend = await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${hAssignId}/extend-deadline`,
        headers: { Cookie: instCookie },
        body: { newDeadline: '2026-12-31' }
      });
      console.log('   Instructor Extend Deadline on Completed (Should fail 400):', badExtend.statusCode);

      const badLock = await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${hAssignId}/lock`,
        headers: { Cookie: instCookie },
        body: { reason: 'Test lock' }
      });
      console.log('   Instructor Lock on Completed (Should fail 400):', badLock.statusCode);

      if (badExtend.statusCode !== 400 || badLock.statusCode !== 400) {
        throw new Error('Backend failed to reject extend/lock actions on completed assignment!');
      }

      // 6. CASE 2 & 3: Lakshya (Assigned / In Progress) -> Lock and Unlock Lakshya only
      console.log('\n6. [CASE 2 & 3] Locking Lakshya (Per-Employee Lock)...');
      const lockLakshya = await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${lAssignId}/lock`,
        headers: { Cookie: instCookie },
        body: { reason: 'Test lock for Lakshya' }
      });
      console.log('   Lock Lakshya Status:', lockLakshya.statusCode);

      // Verify Lakshya is locked
      const lDoc = await TrainingAssignment.findById(lAssignId);
      console.log('   Lakshya Lock State:', lDoc.lockStatus.isLocked, 'Status:', lDoc.status);

      // Verify Harshita and Aman are NOT locked (Per-Employee isolation)
      const hCheck = await TrainingAssignment.findById(hAssignId);
      const aCheck = await TrainingAssignment.findById(aAssignId);
      console.log('   Harshita Locked?:', hCheck.lockStatus?.isLocked || false);
      console.log('   Aman Locked?:', aCheck.lockStatus?.isLocked || false);

      if (lDoc.lockStatus.isLocked !== true || hCheck.lockStatus?.isLocked || aCheck.lockStatus?.isLocked) {
        throw new Error('Per-employee lock isolation failed!');
      }

      // Verify Lakshya access is rejected when locked
      const lakshyaProgressAttempt = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: emp2Cookie },
        body: { trainingAssignmentId: lAssignId, subSectionId: sub1Id }
      });
      console.log('   Lakshya Progress Attempt when Locked (Should fail 403):', lakshyaProgressAttempt.statusCode);

      if (lakshyaProgressAttempt.statusCode !== 403) {
        throw new Error('Locked employee was able to complete lessons!');
      }

      // Unlock Lakshya
      console.log('   Unlocking Lakshya...');
      await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${lAssignId}/unlock`,
        headers: { Cookie: instCookie }
      });
      const lUnlockedDoc = await TrainingAssignment.findById(lAssignId);
      console.log('   Lakshya Unlocked State:', lUnlockedDoc.lockStatus.isLocked, 'Status:', lUnlockedDoc.status);

      // 7. CASE 4, 5, 6: Aman (Overdue Employee) -> Lock, Unlock, Extend Deadline
      console.log('\n7. [CASE 4, 5, 6] Simulating Overdue status for Aman...');
      await TrainingAssignment.findByIdAndUpdate(aAssignId, { deadline: new Date('2026-01-01'), status: 'Overdue' });

      const aOverdueDoc = await TrainingAssignment.findById(aAssignId);
      console.log('   Aman Status:', aOverdueDoc.status, 'Deadline:', aOverdueDoc.deadline);

      // Lock Overdue Aman
      console.log('   Locking Overdue Aman...');
      await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${aAssignId}/lock`,
        headers: { Cookie: instCookie },
        body: { reason: 'Overdue policy lock' }
      });

      const aLockedDoc = await TrainingAssignment.findById(aAssignId);
      console.log('   Aman Locked State:', aLockedDoc.lockStatus.isLocked, 'Status:', aLockedDoc.status);

      // Unlock Overdue Aman -> Should revert to Overdue because deadline is in past
      console.log('   Unlocking Overdue Aman...');
      await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${aAssignId}/unlock`,
        headers: { Cookie: instCookie }
      });

      const aUnlockedDoc = await TrainingAssignment.findById(aAssignId);
      console.log('   Aman Unlocked State:', aUnlockedDoc.lockStatus.isLocked, 'Status:', aUnlockedDoc.status);

      if (aUnlockedDoc.status !== 'Overdue') {
        throw new Error('Unlocking overdue assignment failed to maintain Overdue status!');
      }

      // Extend Deadline for Aman -> Should update deadline and clear Overdue status to Assigned/In Progress
      console.log('   Extending Deadline for Aman to 2026-12-31...');
      await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/${aAssignId}/extend-deadline`,
        headers: { Cookie: instCookie },
        body: { newDeadline: '2026-12-31', reason: 'Extended after extension request' }
      });

      const aExtendedDoc = await TrainingAssignment.findById(aAssignId);
      console.log('   Aman Status after Extension:', aExtendedDoc.status, 'Deadline:', aExtendedDoc.deadline);

      if (aExtendedDoc.status === 'Overdue' || aExtendedDoc.status === 'Locked') {
        throw new Error('Extending deadline failed to clear Overdue/Locked status!');
      }

      console.log('\n🎉 INSTRUCTOR OVERDUE & PER-EMPLOYEE LOCK CONTROLS E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runOverdueAndLockControlsE2ETest();
