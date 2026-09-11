const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5011 }) {
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

async function runAutoAssignmentReportTest() {
  console.log('🚀 Verifying Auto Assignment Rules & Department Rankings in Reports Suite...\n');

  await connectDB();

  const server = app.listen(5011, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `auto_rpt_admin_${ts}@test.com`;
      const empEmail = `auto_rpt_emp_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Auto Rule Rpt Org ${ts}`,
          orgCode: `ARR${ts.toString().slice(-4)}`,
          adminName: 'Auto Rpt Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;
      const orgCode = setupRes.body.data.organization.code;

      // 2. Create Departments
      console.log('\n2. Creating Department (Quality Assurance)...');
      const depRes = await makeRequest({
        method: 'POST',
        path: '/api/org/departments',
        headers: { Cookie: adminCookie },
        body: { name: 'Quality Assurance', jobRoles: ['QA Automation Lead'] }
      });
      const depId = depRes.body.data.department._id;

      // 3. Register Employee & Assign to Department
      console.log('\n3. Registering Employee & setting QA department...');
      const empReg = await makeRequest({
        method: 'POST',
        path: '/api/auth/register-employee',
        body: { name: 'QA Tester', email: empEmail, password: 'Password123', orgCode }
      });
      await makeRequest({
        method: 'PUT',
        path: '/api/auth/profile',
        headers: { Cookie: empReg.cookie },
        body: { departmentId: depId, jobRole: 'QA Automation Lead' }
      });

      // 4. Create Category & Published Training
      console.log('\n4. Creating & Publishing Mandatory Training Course...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Safety & POSH' }
      });
      const catId = catRes.body.data.category._id;

      const trainRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings',
        headers: { Cookie: adminCookie },
        body: {
          title: 'Mandatory POSH 2026 Awareness',
          description: 'Compulsory Sexual Harassment Prevention',
          categoryId: catId,
          durationDays: 15
        }
      });
      const trainingId = trainRes.body.data.training._id;

      await makeRequest({
        method: 'PUT',
        path: `/api/trainings/${trainingId}`,
        headers: { Cookie: adminCookie },
        body: { isPublished: true, status: 'published' }
      });

      // 5. Create Auto Assignment Rule in Training Assignment Engine
      console.log('\n5. Creating Auto-Assignment Rule via Training Assignment Engine...');
      const ruleRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/auto-rule',
        headers: { Cookie: adminCookie },
        body: {
          ruleName: 'POSH Compulsory Auto-Rule',
          trainingId,
          isCompulsory: true,
          customDeadlineDays: 15
        }
      });
      console.log('   Auto Rule Response Status:', ruleRes.statusCode);

      // 6. Fetch Full Org Report API (GET /api/reports/full-org-report)
      console.log('\n6. Fetching GET /api/reports/full-org-report and checking mandatoryAnalytics & complianceLeaderboard...');
      const rptRes = await makeRequest({
        method: 'GET',
        path: '/api/reports/full-org-report',
        headers: { Cookie: adminCookie }
      });

      console.log('   API Response Status:', rptRes.statusCode);
      const mandatoryRules = rptRes.body.data.mandatoryAnalytics;
      const leaderboard = rptRes.body.data.complianceLeaderboard;

      console.log('   Mandatory Rules Count:', mandatoryRules.length);
      console.log('   Mandatory Rule Object:', mandatoryRules[0]);
      console.log('   Leaderboard Status:', leaderboard[0]);

      if (
        rptRes.statusCode === 200 &&
        mandatoryRules.length === 1 &&
        mandatoryRules[0].trainingTitle === 'Mandatory POSH 2026 Awareness' &&
        mandatoryRules[0].totalAssigned === 1 &&
        leaderboard.length === 1 &&
        (leaderboard[0].status === 'Needs Attention' || leaderboard[0].status === 'At Risk')
      ) {
        console.log('\n🎉 AUTO ASSIGNMENT RULE & LEADERBOARD VERIFICATION PASSED PERFECTLY! 🎉');
      } else {
        throw new Error('Auto assignment rule did not appear in mandatoryAnalytics or leaderboard status mismatch');
      }

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runAutoAssignmentReportTest();
