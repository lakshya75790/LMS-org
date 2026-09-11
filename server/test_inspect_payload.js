const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

async function testInspectPayload() {
  await connectDB();
  const server = app.listen(5027, async () => {
    try {
      const ts = Date.now();
      const adminRes = await new Promise((resolve) => {
        const req = http.request({ hostname: '127.0.0.1', port: 5027, path: '/api/auth/setup-org', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
          let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ cookie: res.headers['set-cookie'][0].split(';')[0] }));
        });
        req.write(JSON.stringify({ orgName: `Inspect Org ${ts}`, orgCode: `IO${ts.toString().slice(-4)}`, adminName: 'Admin', adminEmail: `admin_${ts}@test.com`, adminPassword: 'Password123' }));
        req.end();
      });

      const catRes = await new Promise((resolve) => {
        const req = http.request({ hostname: '127.0.0.1', port: 5027, path: '/api/categories', method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminRes.cookie } }, res => {
          let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(JSON.parse(data)));
        });
        req.write(JSON.stringify({ name: 'Inspect Category' }));
        req.end();
      });

      const courseRes = await new Promise((resolve) => {
        const req = http.request({ hostname: '127.0.0.1', port: 5027, path: '/api/trainings/save-full-course', method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminRes.cookie } }, res => {
          let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(JSON.parse(data)));
        });
        req.write(JSON.stringify({
          title: 'Course Payload Test',
          description: 'desc',
          categoryId: catRes.data.category._id,
          status: 'published',
          sections: [{
            title: 'Section 1',
            lectures: [{ title: 'Lecture 1', description: 'desc' }],
            quiz: { title: 'Quiz 1', questions: [{ questionText: 'Q1', options: ['A', 'B'], correctAnswerIndex: 0 }] },
            assignment: { title: 'Assignment 1', instructions: 'instr' }
          }]
        }));
        req.end();
      });

      console.log('Sections SubSections Payload:', JSON.stringify(courseRes.data.training.sections[0].subSections, null, 2));
      server.close(() => process.exit(0));
    } catch (e) {
      console.error(e);
      server.close(() => process.exit(1));
    }
  });
}
testInspectPayload();
