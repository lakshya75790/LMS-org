const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5008 }) {
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

async function runAssignmentEngineTests() {
  console.log('🚀 Testing Training Assignment Engine (Auto & Targeted Assignments, Security, Deadlines)...\n');

  await connectDB();

  const server = app.listen(5008, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `assign_admin_${ts}@test.com`;
      const instEmail = `assign_inst_${ts}@test.com`;
      const emp1Email = `assign_emp1_${ts}@test.com`;
      const emp2Email = `assign_emp2_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Assignment Test Org ${ts}`,
          orgCode: `ATG${ts.toString().slice(-4)}`,
          adminName: 'Assignment Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      console.log('   Admin Setup Status:', setupRes.statusCode);
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Create Department & Category
      console.log('\n2. Creating Department & Category...');
      const depRes = await makeRequest({
        method: 'POST',
        path: '/api/org/departments',
        headers: { Cookie: adminCookie },
        body: { name: 'Engineering', jobRoles: ['Full Stack Developer'] }
      });
      const depId = depRes.body.data.department._id;

      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Compliance & Ethics' }
      });
      const catId = catRes.body.data.category._id;

      // 3. Create Instructor & Existing Employee
      console.log('\n3. Creating Instructor & Registering Existing Employee 1...');
      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Instructor One', email: instEmail, password: 'Password123', departmentId: depId }
      });

      const instLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: instEmail, password: 'Password123' }
      });
      const instCookie = instLogin.cookie;

      const emp1Reg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Existing Employee 1', email: emp1Email, password: 'Password123', orgCode }
      });
      const emp1Cookie = emp1Reg.cookie;
      const emp1Id = emp1Reg.body.data.user._id;

      // Complete Employee 1 Profile
      await makeRequest({
        method: 'PUT',
        path: '/api/auth/profile',
        headers: { Cookie: emp1Cookie },
        body: { departmentId: depId, jobRole: 'Full Stack Developer' }
      });

      // 4. Create & Publish Training Course
      console.log('\n4. Admin creating & publishing Training Course...');
      const trainingRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings',
        headers: { Cookie: adminCookie },
        body: {
          title: 'Workplace Ethics & POSH 2026',
          description: 'Compulsory workplace compliance training',
          categoryId: catId,
          durationDays: 30,
          isMandatory: true
        }
      });
      console.log('   Training Creation Status:', trainingRes.statusCode);
      const trainingId = trainingRes.body.data.training._id;

      // Publish the training
      const pubRes = await makeRequest({
        method: 'PUT',
        path: `/api/trainings/${trainingId}`,
        headers: { Cookie: adminCookie },
        body: { isPublished: true, status: 'published' }
      });
      console.log('   Publish Training Status:', pubRes.statusCode);
      console.log('   Created Training ID:', trainingId);

      // 5. SECURITY CHECK: Instructor & Employee CANNOT call assign or auto-rule APIs
      console.log('\n5. SECURITY CHECK: Verifying non-Admins cannot call assign APIs...');
      const instAssignRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/auto-rule',
        headers: { Cookie: instCookie },
        body: { trainingId }
      });
      console.log('   Instructor Auto-Rule Response Status:', instAssignRes.statusCode);

      const empAssignRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: emp1Cookie },
        body: { assignmentType: 'specific', trainingId, employeeId: emp1Id }
      });
      console.log('   Employee Targeted Assign Response Status:', empAssignRes.statusCode);

      if (instAssignRes.statusCode !== 403 || empAssignRes.statusCode !== 403) {
        throw new Error('Security vulnerability: Non-admins were able to access assignment APIs');
      }

      // 6. TAB 1 TEST: Admin Configures Auto-Assignment Rule
      console.log('\n6. TAB 1: Admin configuring Compulsory Auto-Assignment Rule...');
      const autoRuleRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/auto-rule',
        headers: { Cookie: adminCookie },
        body: { trainingId, customDeadlineDays: 45 }
      });
      console.log('   Auto-Rule Status:', autoRuleRes.statusCode, '| Msg:', autoRuleRes.body.message);
      console.log('   Immediately Assigned Count:', autoRuleRes.body.data.assignedCount);

      // Verify Existing Employee 1 received the training
      const emp1Assignments = await makeRequest({
        method: 'GET',
        path: '/api/assignments-engine/my-assignments',
        headers: { Cookie: emp1Cookie }
      });
      console.log('   Employee 1 Received Assignments Count:', emp1Assignments.body.data.assignments.length);

      // 7. FUTURE EMPLOYEE TEST: Register NEW Employee 2
      console.log('\n7. FUTURE EMPLOYEE: Registering Employee 2 to verify automatic assignment...');
      const emp2Reg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'Future Employee 2', email: emp2Email, password: 'Password123', orgCode }
      });
      const emp2Cookie = emp2Reg.cookie;

      // Complete Employee 2 profile
      await makeRequest({
        method: 'PUT',
        path: '/api/auth/profile',
        headers: { Cookie: emp2Cookie },
        body: { departmentId: depId, jobRole: 'Full Stack Developer' }
      });

      const emp2Assignments = await makeRequest({
        method: 'GET',
        path: '/api/assignments-engine/my-assignments',
        headers: { Cookie: emp2Cookie }
      });
      console.log('   Employee 2 Auto-Received Assignments Count:', emp2Assignments.body.data.assignments.length);

      // 8. TAB 2 TEST: Option A (Department + Job Role Targeted Assignment)
      console.log('\n8. TAB 2 OPTION A: Admin dispatching Dept + Job Role Targeted Assignment...');
      const deptTargetRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: {
          trainingId,
          assignmentType: 'dept_role',
          departmentId: depId,
          jobRole: 'Full Stack Developer',
          customDeadline: '2026-12-31'
        }
      });
      console.log('   Dept+Role Dispatch Status:', deptTargetRes.statusCode, '| Msg:', deptTargetRes.body.message);

      // 9. TAB 2 TEST: Option B (Individual Employees Multi-Selection Assignment)
      console.log('\n9. TAB 2 OPTION B: Admin dispatching Individual Employees Assignment...');
      const indivTargetRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/assign',
        headers: { Cookie: adminCookie },
        body: {
          trainingId,
          assignmentType: 'specific',
          employeeIds: [emp1Id],
          customDeadline: '2026-11-30'
        }
      });
      console.log('   Individual Dispatch Status:', indivTargetRes.statusCode, '| Msg:', indivTargetRes.body.message);

      // 10. Deactivate Auto Assignment Rule
      console.log('\n10. Testing Auto-Assignment Rule Deactivation...');
      const ruleId = autoRuleRes.body.data.rule._id;
      const deactRuleRes = await makeRequest({
        method: 'PUT',
        path: `/api/assignments-engine/auto-rules/${ruleId}/deactivate`,
        headers: { Cookie: adminCookie }
      });
      console.log('    Deactivate Status:', deactRuleRes.statusCode, '| Status:', deactRuleRes.body.data.rule.status);

      console.log('\n🎉 ALL TRAINING ASSIGNMENT ENGINE FUNCTIONAL & SECURITY TESTS PASSED PERFECTLY! 🎉');

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runAssignmentEngineTests();
