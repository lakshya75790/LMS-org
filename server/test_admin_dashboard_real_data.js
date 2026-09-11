const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5007 }) {
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

async function runDashboardIntegrationTest() {
  console.log('🚀 Verifying Admin Dashboard API Integration with Real Data...\n');

  await connectDB();

  const server = app.listen(5007, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `dash_admin_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Dash Test Org ${ts}`,
          orgCode: `DSH${ts.toString().slice(-4)}`,
          adminName: 'Dashboard Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      console.log('   Setup Status:', setupRes.statusCode);
      const adminCookie = setupRes.cookie;

      // 2. Fetch Admin Dashboard Reports API
      console.log('\n2. Fetching GET /api/reports/admin-dashboard...');
      const dashRes = await makeRequest({
        method: 'GET',
        path: '/api/reports/admin-dashboard',
        headers: { Cookie: adminCookie }
      });

      console.log('   Dashboard API Status:', dashRes.statusCode);
      console.log('   Quick Stats:', dashRes.body.data.quickStats);
      console.log('   Department Performance Count:', dashRes.body.data.departmentPerformance.length);
      console.log('   Recent Audit Logs Count:', dashRes.body.data.recentLogs.length);
      if (dashRes.body.data.recentLogs.length > 0) {
        console.log('   Sample Audit Log Action:', dashRes.body.data.recentLogs[0].action);
      }

      // Assertions
      if (
        dashRes.statusCode === 200 &&
        dashRes.body.data.quickStats &&
        dashRes.body.data.departmentPerformance !== undefined &&
        dashRes.body.data.recentLogs !== undefined
      ) {
        console.log('\n🎉 ADMIN DASHBOARD BACKEND API VERIFICATION PASSED PERFECTLY! 🎉');
      } else {
        throw new Error('API response does not contain expected quickStats, departmentPerformance, and recentLogs keys');
      }

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runDashboardIntegrationTest();
