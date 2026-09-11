const http = require('http');

function measureApi(options, postData) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      let cookies = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, duration, cookies, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, duration, cookies, body: data });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ status: 500, duration: Date.now() - start, error: e.message });
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function audit() {
  console.log('--- STARTING PERFORMANCE AUDIT & BENCHMARKING ---');

  // 1. Health check
  const health = await measureApi({ hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET' });
  console.log(`GET /api/health                    → ${health.status} (${health.duration}ms)`);

  // 2. Setup Org / Admin
  const email = `perf_${Date.now()}@test.com`;
  const setup = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/auth/setup-org', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    orgName: 'Performance Test Org',
    orgCode: `PERF-${Math.floor(1000 + Math.random() * 9000)}`,
    adminName: 'Perf Admin',
    adminEmail: email,
    adminPassword: 'Password123!'
  });
  console.log(`POST /api/auth/setup-org           → ${setup.status} (${setup.duration}ms)`);
  const adminCookie = setup.cookies ? setup.cookies[0] : null;

  // 3. Login
  const login = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password: 'Password123!' });
  console.log(`POST /api/auth/login               → ${login.status} (${login.duration}ms)`);

  // 4. GET /api/auth/me
  const me = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/auth/me', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log(`GET /api/auth/me                   → ${me.status} (${me.duration}ms)`);

  // 5. POST /api/org/departments
  const createDept = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/org/departments', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie }
  }, { name: 'Engineering', description: 'Software Engineering', jobRoles: ['FullStack'] });
  console.log(`POST /api/org/departments          → ${createDept.status} (${createDept.duration}ms)`);
  const deptId = createDept.body?.data?.department?._id;

  // 6. GET /api/org/departments
  const getDepts = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/org/departments', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log(`GET /api/org/departments           → ${getDepts.status} (${getDepts.duration}ms)`);

  // 7. POST /api/org/instructors
  const createInst = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/org/instructors', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie }
  }, { name: 'Dr. Turing', email: `inst_${Date.now()}@test.com`, password: 'Password123!', departmentId: deptId });
  console.log(`POST /api/org/instructors          → ${createInst.status} (${createInst.duration}ms)`);

  // 8. GET /api/org/instructors
  const getInsts = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/org/instructors', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log(`GET /api/org/instructors           → ${getInsts.status} (${getInsts.duration}ms)`);

  // 9. GET /api/org/employees
  const getEmps = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/org/employees', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log(`GET /api/org/employees             → ${getEmps.status} (${getEmps.duration}ms)`);

  // 10. GET /api/categories
  const getCats = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/categories', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log(`GET /api/categories                → ${getCats.status} (${getCats.duration}ms)`);

  // 11. GET /api/reports/admin-dashboard
  const getAdminDash = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/reports/admin-dashboard', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log(`GET /api/reports/admin-dashboard   → ${getAdminDash.status} (${getAdminDash.duration}ms)`);

  // 12. GET /api/reports/full-org-report
  const getFullReport = await measureApi({
    hostname: 'localhost', port: 5000, path: '/api/reports/full-org-report', method: 'GET',
    headers: { 'Cookie': adminCookie }
  });
  console.log(`GET /api/reports/full-org-report   → ${getFullReport.status} (${getFullReport.duration}ms)`);

  console.log('--- PERFORMANCE AUDIT COMPLETE ---');
}

audit();
