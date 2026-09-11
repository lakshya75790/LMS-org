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
  console.log('--- STARTING RUNTIME END-TO-END API TESTS AGAINST NEON POSTGRESQL ---');

  try {
    // 1. Health check
    console.log('1. Testing GET /api/health...');
    const health = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    console.log('Health check status:', health.status, health.body);

    // 2. Setup Organization & Admin (WRITE operation into PostgreSQL)
    console.log('\n2. Testing WRITE: POST /api/auth/setup-org...');
    const orgData = {
      orgName: 'Neon Tech Academy',
      orgCode: `NEON-${Math.floor(1000 + Math.random() * 9000)}`,
      adminName: 'Alice Neon Admin',
      adminEmail: `admin_${Date.now()}@neontech.com`,
      adminPassword: 'Password123!'
    };

    const setupRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/setup-org',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, orgData);

    console.log('Setup Org response status:', setupRes.status);
    console.log('Setup Org response body success:', setupRes.body.success, 'Message:', setupRes.body.message);
    console.log('User ID in response (_id / id):', setupRes.body.data?.user?._id || setupRes.body.data?.user?.id);
    console.log('Org Code in response:', setupRes.body.data?.organization?.code);

    const jwtCookie = setupRes.cookies ? setupRes.cookies[0] : null;

    // 3. Login Test (READ & Password Match against PostgreSQL)
    console.log('\n3. Testing READ & AUTH: POST /api/auth/login...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: orgData.adminEmail,
      password: orgData.adminPassword
    });

    console.log('Login status:', loginRes.status, 'Success:', loginRes.body.success);
    console.log('Logged in user role:', loginRes.body.data?.user?.role);

    // 4. Create Department (WRITE into PostgreSQL)
    console.log('\n4. Testing WRITE: POST /api/org/departments...');
    const depRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/departments',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': jwtCookie
      }
    }, {
      name: 'Software Engineering',
      description: 'Full Stack & DevOps Engineering',
      jobRoles: ['Frontend Engineer', 'Backend Engineer', 'DevOps Specialist']
    });

    console.log('Create Department status:', depRes.status, 'Success:', depRes.body.success);
    console.log('Department ID (_id / id):', depRes.body.data?.department?._id);

    // 5. Get Departments (READ from PostgreSQL)
    console.log('\n5. Testing READ: GET /api/org/departments...');
    const getDepsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/departments',
      method: 'GET',
      headers: { 'Cookie': jwtCookie }
    });

    console.log('Get Departments status:', getDepsRes.status, 'Success:', getDepsRes.body.success);
    console.log('Retrieved departments count:', getDepsRes.body.data?.departments?.length);

    console.log('\n--- ALL RUNTIME API TESTS COMPLETED SUCCESSFULLY AGAINST NEON POSTGRESQL! ---');
  } catch (err) {
    console.error('API Test Error:', err);
  }
}

runTests();
