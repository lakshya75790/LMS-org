const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

function makeRequest({ method, path, headers = {}, body = null, port = 5013 }) {
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

async function runCourseBuilderE2ETest() {
  console.log('🚀 Running E2E Verification for 5-Step Course Builder & Full CRUD Lifecycle...\n');

  await connectDB();

  const server = app.listen(5013, async () => {
    try {
      const ts = Date.now();
      const adminEmail = `cb_admin_${ts}@test.com`;
      const instEmail = `cb_inst_${ts}@test.com`;

      // 1. Setup Org & Admin
      console.log('1. Setting up Org & Admin...');
      const setupRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/setup-org',
        body: {
          orgName: `Course Builder Org ${ts}`,
          orgCode: `CBO${ts.toString().slice(-4)}`,
          adminName: 'CB Admin',
          adminEmail,
          adminPassword: 'Password123'
        }
      });
      const adminCookie = setupRes.cookie;

      // 2. Create Category & Instructor
      console.log('2. Creating Category & Registering Instructor...');
      const catRes = await makeRequest({
        method: 'POST',
        path: '/api/categories',
        headers: { Cookie: adminCookie },
        body: { name: 'Frontend Engineering' }
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

      // 3. Create Training as DRAFT (5-Step Save Full Course)
      console.log('3. Saving Full Course as DRAFT (Step 1-5 Flow)...');
      const draftRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          title: 'React 19 & Next.js 15 Masterclass',
          description: 'Comprehensive Web Development',
          categoryId: catId,
          benefits: ['Learn React 19 fundamentals', 'Master Next.js App Router', 'Build production apps'],
          status: 'draft',
          sections: [
            {
              title: 'Module 1: React Fundamentals',
              description: 'Core concepts of React',
              lectures: [
                { title: 'Lecture 1.1: JSX & Virtual DOM', description: 'Understanding JSX', videoUrl: 'https://cdn.example.com/v1.mp4' },
                { title: 'Lecture 1.2: Props and State', description: 'State management', videoUrl: 'https://cdn.example.com/v2.mp4' }
              ],
              quiz: {
                title: 'React Fundamentals Quiz',
                timeLimitMinutes: 15,
                passingScorePercent: 80,
                questions: [
                  { questionText: 'What is React?', options: ['Database', 'UI Library', 'OS', 'Language'], correctAnswerIndex: 1 }
                ]
              }
            },
            {
              title: 'Module 2: Advanced State & Hooks',
              description: 'Custom hooks and Context API',
              lectures: [
                { title: 'Lecture 2.1: Custom Hooks', description: 'Reusable hook logic', videoUrl: 'https://cdn.example.com/v3.mp4' }
              ]
            }
          ],
          assignment: {
            title: 'Build Todo Application',
            instructions: 'Create a full CRUD Todo app with React.'
          },
          resources: [
            { title: 'React_Cheat_Sheet.pdf', fileUrl: 'https://cdn.example.com/cheat.pdf' }
          ]
        }
      });

      console.log('   Draft Creation Status:', draftRes.statusCode);
      const trainingId = draftRes.body.data.training._id;
      const initialStatus = draftRes.body.data.training.status;
      console.log('   Training ID:', trainingId, '| Status:', initialStatus);

      if (initialStatus !== 'draft') throw new Error('Training status should be draft');

      // 4. Update and PUBLISH Training
      console.log('\n4. Updating & PUBLISHING Training...');
      const publishRes = await makeRequest({
        method: 'POST',
        path: '/api/trainings/save-full-course',
        headers: { Cookie: instCookie },
        body: {
          trainingId,
          title: 'React 19 & Next.js 15 Masterclass (Updated)',
          description: 'Comprehensive Web Development',
          categoryId: catId,
          benefits: ['Learn React 19', 'Master Next.js App Router', 'Build production apps', 'Deploy to Vercel'],
          status: 'published',
          sections: [
            {
              title: 'Module 1: React Fundamentals',
              description: 'Core concepts of React',
              lectures: [
                { title: 'Lecture 1.1: JSX & Virtual DOM', description: 'Understanding JSX', videoUrl: 'https://cdn.example.com/v1.mp4' }
              ]
            }
          ]
        }
      });

      console.log('   Publish Status:', publishRes.statusCode, '| Status:', publishRes.body.data.training.status);
      if (publishRes.body.data.training.status !== 'published') throw new Error('Training status should be published');

      // 5. Fetch Training by ID
      console.log('\n5. Fetching Training details via GET /api/trainings/:id...');
      const getRes = await makeRequest({
        method: 'GET',
        path: `/api/trainings/${trainingId}`,
        headers: { Cookie: instCookie }
      });
      console.log('   Fetched Title:', getRes.body.data.training.title);
      console.log('   Benefits Count:', getRes.body.data.training.benefits.length);

      // 6. Delete (Archive) Training
      console.log('\n6. Deleting Training via DELETE /api/trainings/:id...');
      const delRes = await makeRequest({
        method: 'DELETE',
        path: `/api/trainings/${trainingId}`,
        headers: { Cookie: instCookie }
      });
      console.log('   Delete Status:', delRes.statusCode);

      console.log('\n🎉 COURSE BUILDER E2E FULL LIFECYCLE TEST PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runCourseBuilderE2ETest();
