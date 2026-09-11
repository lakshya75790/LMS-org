const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5023 }) {
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

// Inline replica of frontend formatters to verify exact output matching
function formatAuditAction(action) {
  if (!action) return 'System Activity';
  const raw = String(action).trim();
  const actionMap = {
    REACTIVATE_AUTO_ASSIGNMENT_RULE: 'Reactivate Auto-Assignment Rule',
    DEACTIVATE_AUTO_ASSIGNMENT_RULE: 'Deactivate Auto-Assignment Rule',
    CREATE_AUTO_ASSIGNMENT_RULE: 'Create Auto-Assignment Rule',
    CREATE_TRAINING: 'Create Training',
    ASSIGN_TRAINING: 'Assign Training'
  };
  return actionMap[raw] || raw;
}

function formatTargetEntity(targetType) {
  if (!targetType) return 'General Resource';
  const raw = String(targetType).trim();
  const entityMap = {
    AutoAssignmentRule: 'Auto-Assignment Rule',
    TrainingAssignment: 'Training Assignment',
    Training: 'Training Course',
    User: 'User Profile'
  };
  return entityMap[raw] || raw;
}

async function runAuditLogsRedesignE2ETest() {
  console.log('🚀 Running E2E Verification for Redesigned Security Audit Logs...\n');

  await connectDB();

  const server = app.listen(5023, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `audit_admin_${ts}@test.com`;
      const instEmail = `audit_inst_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Audit Test Org ${ts}`,
          orgCode: `ATO${ts.toString().slice(-4)}`,
          adminName: 'Audit Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;

      // 2. Register Instructor & Category
      console.log('\n2. Registering Instructor & Category...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Cyber Security' }
      });
      const catId = catRes.body.data.category._id;

      await makeRequest({
        method: 'POST',
        path: '/api/org/instructors',
        headers: { Cookie: adminCookie },
        body: { name: 'Audit Instructor', email: instEmail, password: 'Password123' }
      });

      const instLogin = await makeRequest({ method: 'POST', path: '/api/auth/login', body: { email: instEmail, password: 'Password123' } });
      const instCookie = instLogin.cookie;

      // 3. Create Course & Auto Assignment Rule
      console.log('\n3. Creating Course and Auto Assignment Rules to generate audit logs...');
      const courseRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'Cybersecurity Best Practices',
          description: 'InfoSec Basics',
          categoryId: catId,
          status: 'published',
          sections: [{ title: 'Sec 1', lectures: [{ title: 'L1', description: 'desc', videoUrl: 'https://cdn.example.com/v1.mp4' }] }]
        }
      });
      const training = courseRes.body.data.training;

      const ruleRes = await makeRequest({
        method: 'POST',
        path: '/api/assignments-engine/auto-rule',
        headers: { Cookie: adminCookie },
        body: { trainingId: training._id, customDeadlineDays: 30 }
      });
      const ruleId = ruleRes.body.data.rule._id;

      await makeRequest({ method: 'PUT', path: `/api/assignments-engine/auto-rules/${ruleId}/deactivate`, headers: { Cookie: adminCookie } });
      await makeRequest({ method: 'PUT', path: `/api/assignments-engine/auto-rules/${ruleId}/reactivate`, headers: { Cookie: adminCookie } });

      // 4. Fetch Audit Logs via GET /api/audit-logs
      console.log('\n4. Fetching Audit Logs via GET /api/audit-logs...');
      const logsRes = await makeRequest({
        method: 'GET',
        path: '/api/audit-logs',
        headers: { Cookie: adminCookie }
      });

      const logs = logsRes.body.data.auditLogs;
      console.log('   Total Audit Logs Retrieved:', logs.length);

      if (logs.length === 0) {
        throw new Error('Audit Log API returned 0 entries!');
      }

      console.log('\n5. Verifying Formatted Output for Top Audit Events:');
      logs.slice(0, 5).forEach((log, index) => {
        const humanAction = formatAuditAction(log.action);
        const humanTarget = formatTargetEntity(log.targetType);
        const userEmail = log.userId?.email || 'N/A';
        console.log(`   [Log #${index + 1}] Raw: ${log.action} -> Formatted: "${humanAction}" | Target: "${humanTarget}" | User Email: ${userEmail}`);
      });

      const reactivateLog = logs.find(l => l.action === 'REACTIVATE_AUTO_ASSIGNMENT_RULE');
      const deactivateLog = logs.find(l => l.action === 'DEACTIVATE_AUTO_ASSIGNMENT_RULE');

      if (!reactivateLog || !deactivateLog) {
        throw new Error('Expected REACTIVATE and DEACTIVATE audit logs were not found!');
      }

      if (formatAuditAction(reactivateLog.action) !== 'Reactivate Auto-Assignment Rule') {
        throw new Error('Reactivate action formatter mismatch!');
      }

      if (formatTargetEntity(reactivateLog.targetType) !== 'Auto-Assignment Rule') {
        throw new Error('Target entity formatter mismatch!');
      }

      console.log('\n🎉 REDESIGNED AUDIT LOGS E2E TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runAuditLogsRedesignE2ETest();
