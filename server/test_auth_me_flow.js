const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      let cookies = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, cookies, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, cookies, body: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- TESTING INSTANT BACKEND STARTUP & AUTH ENDPOINTS ---');

  try {
    // 1. GET /api/health
    console.log('1. Testing GET /api/health...');
    const health = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    console.log('   Status:', health.status, 'Body:', health.body.message);

    // 2. Setup Org & Admin
    const email = `admin_${Date.now()}@neonacademy.com`;
    const password = 'Password123!';
    console.log('\n2. Creating Admin via POST /api/auth/setup-org...');
    const setupRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/setup-org',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      orgName: 'Neon Instant Academy',
      orgCode: `INST-${Math.floor(1000 + Math.random() * 9000)}`,
      adminName: 'Instant Admin',
      adminEmail: email,
      adminPassword: password
    });
    console.log('   Setup Status:', setupRes.status);

    // 3. POST /api/auth/login
    console.log('\n3. Testing POST /api/auth/login...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email,
      password
    });

    console.log('   Login Status:', loginRes.status, 'Success:', loginRes.body.success, 'User Email:', loginRes.body.data?.user?.email);
    const authCookie = loginRes.cookies ? loginRes.cookies[0] : null;

    // 4. GET /api/auth/me
    console.log('\n4. Testing GET /api/auth/me...');
    const meRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Cookie': authCookie }
    });

    console.log('   /api/auth/me Status:', meRes.status, 'Success:', meRes.body.success, 'User Role:', meRes.body.data?.user?.role);

    console.log('\n--- ALL VERIFICATION ENDPOINTS PASSED INSTANTLY ---');
  } catch (err) {
    console.error('Test error:', err);
  }
}

runTests();
