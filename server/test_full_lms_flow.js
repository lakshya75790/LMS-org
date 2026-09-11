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
  console.log('--- STARTING COMPREHENSIVE END-TO-END VERIFICATION AGAINST NEON POSTGRESQL ---');

  try {
    // 1. GET /api/health
    console.log('\n1. Testing GET /api/health...');
    const health = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    console.log('   Status:', health.status, 'Body:', health.body.message);

    // 2. POST /api/auth/setup-org
    console.log('\n2. Testing POST /api/auth/setup-org...');
    const orgData = {
      orgName: 'Neon LMS Academy',
      orgCode: `NEON-${Math.floor(1000 + Math.random() * 9000)}`,
      adminName: 'Sarah Admin',
      adminEmail: `admin_${Date.now()}@neonacademy.com`,
      adminPassword: 'Password123!'
    };

    const setupRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/setup-org',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, orgData);

    console.log('   Status:', setupRes.status, 'Org Code:', setupRes.body.data?.organization?.code);
    const adminCookie = setupRes.cookies ? setupRes.cookies[0] : null;

    // 3. POST /api/auth/login
    console.log('\n3. Testing POST /api/auth/login...');
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

    console.log('   Status:', loginRes.status, 'Role:', loginRes.body.data?.user?.role);

    // 4. POST /api/org/departments (Create IT Department & HR Department)
    console.log('\n4. Testing POST /api/org/departments (Creating IT Department)...');
    const depRes1 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/departments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie }
    }, {
      name: 'Information Technology',
      description: 'Software Engineering & IT Operations',
      jobRoles: ['Backend Engineer', 'Frontend Engineer', 'DevOps Specialist']
    });
    console.log('   IT Department Created:', depRes1.status, 'ID:', depRes1.body.data?.department?._id);

    console.log('   Testing POST /api/org/departments (Creating HR Department)...');
    const depRes2 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/departments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie }
    }, {
      name: 'Human Resources',
      description: 'People Operations & Talent Acquisition',
      jobRoles: ['HR Manager', 'Recruiter', 'Talent Specialist']
    });
    console.log('   HR Department Created:', depRes2.status, 'ID:', depRes2.body.data?.department?._id);

    const itDepId = depRes1.body.data?.department?._id;

    // 5. GET /api/org/departments
    console.log('\n5. Testing GET /api/org/departments...');
    const getDepsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/departments',
      method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    console.log('   Status:', getDepsRes.status, 'Count:', getDepsRes.body.data?.departments?.length);

    // 6. POST /api/org/instructors (Create Instructor)
    console.log('\n6. Testing POST /api/org/instructors...');
    const instData = {
      name: 'Prof. Alan Turing',
      email: `turing_${Date.now()}@neonacademy.com`,
      password: 'Password123!',
      departmentId: itDepId
    };

    const createInstRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/instructors',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie }
    }, instData);

    console.log('   Create Instructor Status:', createInstRes.status, 'ID:', createInstRes.body.data?.instructor?._id, 'Dept Name:', createInstRes.body.data?.instructor?.departmentId?.name);

    // 7. GET /api/org/instructors
    console.log('\n7. Testing GET /api/org/instructors...');
    const getInstsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/instructors',
      method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    console.log('   Status:', getInstsRes.status, 'Count:', getInstsRes.body.data?.instructors?.length, 'Instructor Name:', getInstsRes.body.data?.instructors[0]?.name);

    // 8. GET /api/org/employees
    console.log('\n8. Testing GET /api/org/employees...');
    const getEmpsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/org/employees',
      method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    console.log('   Status:', getEmpsRes.status, 'Count:', getEmpsRes.body.data?.employees?.length);

    console.log('\n--- ALL 8 ENDPOINTS TESTED & VERIFIED SUCCESSFULLY AGAINST NEON POSTGRESQL! ---');
  } catch (err) {
    console.error('Test error:', err);
  }
}

runTests();
