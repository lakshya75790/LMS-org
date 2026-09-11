const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const bcrypt = require('bcryptjs');
const app = require('./app');
const connectDB = require('./config/db');
const { prisma } = require('./config/prismaClient');

function makeRequest({ method, path, headers = {}, body = null, port = 5022 }) {
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

async function runVideoCompletionGatingTest() {
  console.log('🚀 Running E2E Verification for Video Completion Gating & Backend Validation...\n');

  await connectDB();

  const ts = Date.now();
  const orgCode = `VGT${ts.toString().slice(-4)}`;
  const empEmail = `vg_emp_${ts}@test.com`;

  // 1. Seed Org, User, Training, and Assignment directly via Prisma
  console.log('1. Seeding test Organization, Employee, Training & Assignment via Prisma...');
  const org = await prisma.organization.create({
    data: {
      name: `Video Gating Org ${ts}`,
      code: orgCode,
      status: 'ACTIVE'
    }
  });

  const category = await prisma.trainingCategory.create({
    data: {
      name: `Video Engineering ${ts}`,
      organizationId: org.id
    }
  });

  const hashedPassword = await bcrypt.hash('Password123', 10);
  const instructor = await prisma.user.create({
    data: {
      name: 'Video Instructor',
      email: `vg_inst_${ts}@test.com`,
      password: hashedPassword,
      role: 'Instructor',
      organizationId: org.id
    }
  });

  const employee = await prisma.user.create({
    data: {
      name: 'Video Learner',
      email: empEmail,
      password: hashedPassword,
      role: 'Employee',
      organizationId: org.id
    }
  });

  const training = await prisma.training.create({
    data: {
      title: 'Video Stream Processing',
      description: 'Learn streaming fundamentals',
      categoryId: category.id,
      createdBy: instructor.id,
      organizationId: org.id,
      isPublished: true,
      status: 'published',
      sections: {
        create: [
          {
            title: 'Section 1: Video Fundamentals',
            order: 1,
            subSections: {
              create: [
                {
                  title: 'Lecture 1: HLS Protocols',
                  description: 'Video lesson',
                  type: 'video',
                  videoUrl: 'https://cdn.example.com/hls.mp4',
                  videoDuration: 180,
                  order: 1
                },
                {
                  title: 'Lecture 2: Documentation',
                  description: 'Text reading lesson',
                  type: 'text',
                  videoUrl: '',
                  order: 2
                }
              ]
            }
          }
        ]
      }
    },
    include: {
      sections: {
        include: { subSections: true }
      }
    }
  });

  const videoSubId = training.sections[0].subSections.find(s => s.title.includes('HLS')).id;
  const textSubId = training.sections[0].subSections.find(s => s.title.includes('Doc')).id;

  const assignment = await prisma.trainingAssignment.create({
    data: {
      employeeId: employee.id,
      trainingId: training.id,
      organizationId: org.id,
      assignmentType: 'specific',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'Assigned',
      progressPercentage: 0
    }
  });

  const server = app.listen(5022, async () => {
    try {
      // 2. Employee Login
      console.log('2. Logging in Employee via HTTP API...');
      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;
      if (empLogin.statusCode !== 200) {
        throw new Error(`Failed to login employee: HTTP ${empLogin.statusCode} - ${JSON.stringify(empLogin.body)}`);
      }

      // 3. Test Backend Validation: Video lesson with progress = 50% -> MUST BE REJECTED (HTTP 400)
      console.log('\n3. Testing Backend Validation: Video completion request at 50% progress...');
      const rejectRes1 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignment.id, subSectionId: videoSubId, videoProgress: 50 }
      });
      console.log('   Response Status Code:', rejectRes1.statusCode);
      console.log('   Response Message:', rejectRes1.body.message);

      if (rejectRes1.statusCode !== 400) {
        throw new Error(`Expected HTTP 400 for 50% video progress, got HTTP ${rejectRes1.statusCode}`);
      }

      // 4. Test Backend Validation: Video lesson without videoProgress payload -> MUST BE REJECTED (HTTP 400)
      console.log('\n4. Testing Backend Validation: Video completion request without videoProgress payload...');
      const rejectRes2 = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignment.id, subSectionId: videoSubId }
      });
      console.log('   Response Status Code:', rejectRes2.statusCode);
      console.log('   Response Message:', rejectRes2.body.message);

      if (rejectRes2.statusCode !== 400) {
        throw new Error(`Expected HTTP 400 for missing video progress, got HTTP ${rejectRes2.statusCode}`);
      }

      // 5. Test Backend Validation: Video lesson with videoProgress = 100% -> MUST SUCCEED (HTTP 200)
      console.log('\n5. Testing Backend Validation: Video completion request at 100% progress...');
      const acceptRes = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignment.id, subSectionId: videoSubId, videoProgress: 100 }
      });
      console.log('   Response Status Code:', acceptRes.statusCode);
      console.log('   Progress Percentage:', acceptRes.body.data.percentage);

      if (acceptRes.statusCode !== 200) {
        throw new Error(`Expected HTTP 200 for 100% video progress, got HTTP ${acceptRes.statusCode}`);
      }

      // 6. Test Non-video lesson completion without videoProgress -> MUST SUCCEED (HTTP 200)
      console.log('\n6. Testing Non-video lesson completion without videoProgress...');
      const textRes = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignment.id, subSectionId: textSubId }
      });
      console.log('   Response Status Code:', textRes.statusCode);
      console.log('   Progress Percentage:', textRes.body.data.percentage);

      if (textRes.statusCode !== 200 || textRes.body.data.percentage !== 100) {
        throw new Error(`Expected HTTP 200 & 100% progress for non-video lesson completion, got HTTP ${textRes.statusCode}`);
      }

      // 7. Test Rewatch: Already completed video lesson re-triggering completion API -> MUST SUCCEED (HTTP 200)
      console.log('\n7. Testing Already Completed Video Lesson rewatching / completion call...');
      const rewatchRes = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignment.id, subSectionId: videoSubId }
      });
      console.log('   Response Status Code:', rewatchRes.statusCode);
      console.log('   Progress Percentage:', rewatchRes.body.data.percentage);

      if (rewatchRes.statusCode !== 200 || rewatchRes.body.data.percentage !== 100) {
        throw new Error(`Expected HTTP 200 for already completed video lesson rewatch, got HTTP ${rewatchRes.statusCode}`);
      }

      console.log('\n🎉 ALL VIDEO COMPLETION GATING & BACKEND VALIDATION TESTS PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runVideoCompletionGatingTest();
