const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const bcrypt = require('bcryptjs');
const app = require('./app');
const connectDB = require('./config/db');
const { prisma } = require('./config/prismaClient');

function makeRequest({ method, path, headers = {}, body = null, port = 5025 }) {
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

async function runCertificationFeatureE2ETest() {
  console.log('🚀 Running E2E Verification for IT360 LMS Certification Feature...\n');

  await connectDB();

  const ts = Date.now();
  const orgCode = `CRT${ts.toString().slice(-4)}`;
  const adminEmail = `cert_admin_${ts}@test.com`;
  const instEmail = `cert_inst_${ts}@test.com`;
  const empEmail = `cert_emp_${ts}@test.com`;

  // 1. Seed Org, Admin, Instructor, Employee, Training & Assignment via Prisma
  console.log('1. Seeding test Organization, Users & Training via Prisma...');
  const org = await prisma.organization.create({
    data: {
      name: `Acme Global Corp ${ts}`,
      code: orgCode,
      status: 'ACTIVE'
    }
  });

  const category = await prisma.trainingCategory.create({
    data: {
      name: `Corporate Governance ${ts}`,
      organizationId: org.id
    }
  });

  const hashedPassword = await bcrypt.hash('Password123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Cert Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'Admin',
      organizationId: org.id
    }
  });

  const instructor = await prisma.user.create({
    data: {
      name: 'Cert Instructor',
      email: instEmail,
      password: hashedPassword,
      role: 'Instructor',
      organizationId: org.id
    }
  });

  const employee = await prisma.user.create({
    data: {
      name: 'Cert Learner',
      email: empEmail,
      password: hashedPassword,
      role: 'Employee',
      organizationId: org.id
    }
  });

  const training = await prisma.training.create({
    data: {
      title: 'Information Security & Risk Management',
      description: 'Enterprise security standards',
      categoryId: category.id,
      createdBy: instructor.id,
      organizationId: org.id,
      isPublished: true,
      status: 'published',
      sections: {
        create: [
          {
            title: 'Module 1: Cyber Security Policies',
            order: 1,
            subSections: {
              create: [
                {
                  title: 'Lesson 1: Phishing & Data Protection',
                  description: 'Security rules',
                  type: 'text',
                  videoUrl: '',
                  order: 1
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

  const subId = training.sections[0].subSections[0].id;

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

  const server = app.listen(5025, async () => {
    try {
      // 2. Employee Login
      console.log('2. Logging in Employee & Admin...');
      const empLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: empEmail, password: 'Password123' }
      });
      const empCookie = empLogin.cookie;

      const adminLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: adminEmail, password: 'Password123' }
      });
      const adminCookie = adminLogin.cookie;

      // 3. Complete Training -> Triggers Automatic Certificate Generation
      console.log('\n3. Completing Training Lesson (Triggers Automatic Certificate Generation)...');
      const completeRes = await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignment.id, subSectionId: subId }
      });

      console.log('   Completion Status:', completeRes.statusCode, 'Percentage:', completeRes.body.data?.percentage);

      // Verify Certificate in Database
      const certInDb = await prisma.certificate.findUnique({
        where: { trainingAssignmentId: assignment.id },
        include: { organization: true }
      });

      if (!certInDb) {
        throw new Error('Certificate was NOT automatically created upon training completion!');
      }

      console.log('   ✓ Certificate automatically generated! ID:', certInDb.certificateId);
      console.log('   ✓ Dynamic Organization Name:', certInDb.templateSnapshot.organizationName);

      // 4. Idempotency Test: Re-calling completion API
      console.log('\n4. Testing Idempotency (Re-triggering completion API)...');
      await makeRequest({
        method: 'POST',
        path: '/api/progress/complete-subsection',
        headers: { Cookie: empCookie },
        body: { trainingAssignmentId: assignment.id, subSectionId: subId }
      });

      const totalCerts = await prisma.certificate.count({
        where: { trainingAssignmentId: assignment.id }
      });
      if (totalCerts !== 1) {
        throw new Error(`Idempotency failed! Created duplicate certificates count: ${totalCerts}`);
      }
      console.log('   ✓ Idempotency verified! Certificate count for assignment remains 1.');

      // 5. Employee API: Get My Certificates
      console.log('\n5. Testing Employee GET /api/certificates/my-certificates...');
      const myCertsRes = await makeRequest({
        method: 'GET',
        path: '/api/certificates/my-certificates',
        headers: { Cookie: empCookie }
      });

      console.log('   Employee Certificates Count:', myCertsRes.body.data?.certificates?.length);
      if (!myCertsRes.body.data?.certificates?.length) {
        throw new Error('Employee failed to retrieve earned certificate via API!');
      }

      // 6. Test Backfill for Past Completed Assignments
      console.log('\n6. Testing Backfill capability for past completed training assignment...');
      // Create past training & completed assignment without certificate
      const pastTraining = await prisma.training.create({
        data: {
          title: `Past Training ${ts}`,
          description: 'Historical course',
          categoryId: category.id,
          createdBy: instructor.id,
          organizationId: org.id,
          isPublished: true,
          status: 'published'
        }
      });

      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const pastAssignment = await prisma.trainingAssignment.create({
        data: {
          employeeId: employee.id,
          trainingId: pastTraining.id,
          organizationId: org.id,
          assignmentType: 'specific',
          deadline: pastDate,
          completedDate: pastDate,
          status: 'Completed',
          progressPercentage: 100
        }
      });

      // Check Backfill Eligible API
      const eligibleRes = await makeRequest({
        method: 'GET',
        path: '/api/certificates/backfill-eligible',
        headers: { Cookie: adminCookie }
      });
      console.log('   Backfill Eligible Count:', eligibleRes.body.data?.count);
      if (eligibleRes.body.data?.count !== 1) {
        throw new Error(`Expected 1 backfill eligible assignment, got ${eligibleRes.body.data?.count}`);
      }

      // Trigger Backfill API
      const backfillRes = await makeRequest({
        method: 'POST',
        path: '/api/certificates/backfill',
        headers: { Cookie: adminCookie }
      });
      console.log('   Backfill Result Message:', backfillRes.body.message);

      const pastCertInDb = await prisma.certificate.findUnique({
        where: { trainingAssignmentId: pastAssignment.id }
      });
      if (!pastCertInDb) {
        throw new Error('Backfill failed to generate certificate for past completed assignment!');
      }

      console.log('   ✓ Backfilled Certificate ID:', pastCertInDb.certificateId);
      console.log('   ✓ Backfilled Completion Date preserved:', pastCertInDb.completionDate.toISOString());

      // 7. Test Admin Certificate Template Designer & Immutable Snapshot Preservation
      console.log('\n7. Testing Certificate Template Designer & Immutable Snapshot Preservation...');
      // Admin updates template to new style
      await makeRequest({
        method: 'PUT',
        path: '/api/certificates/template',
        headers: { Cookie: adminCookie },
        body: {
          title: 'EXCELLENCE CERTIFICATE',
          primaryColor: '#047857', // Emerald
          borderStyle: 'double_emerald'
        }
      });

      // Old certificate snapshot must remain unchanged
      const cert1AfterTplUpdate = await prisma.certificate.findUnique({
        where: { id: certInDb.id }
      });

      if (cert1AfterTplUpdate.templateSnapshot.title !== 'CERTIFICATE OF COMPLETION') {
        throw new Error('Old certificate snapshot was overwritten when template settings changed!');
      }
      console.log('   ✓ Old Certificate preserved original template title:', cert1AfterTplUpdate.templateSnapshot.title);

      // 8. Test Role-Based Access Control (RBAC)
      console.log('\n8. Testing RBAC Security...');
      // Register employee in Org B
      const orgB = await prisma.organization.create({
        data: { name: 'Org B Security Test', code: `ORGB${ts.toString().slice(-4)}` }
      });
      const empB = await prisma.user.create({
        data: { name: 'Emp B', email: `emp_b_${ts}@test.com`, password: hashedPassword, role: 'Employee', organizationId: orgB.id }
      });
      const loginB = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: `emp_b_${ts}@test.com`, password: 'Password123' }
      });

      // Employee B tries to access Employee A's certificate -> MUST BE REJECTED (403)
      const rbacRes = await makeRequest({
        method: 'GET',
        path: `/api/certificates/${certInDb.id}`,
        headers: { Cookie: loginB.cookie }
      });
      console.log('   RBAC Unauthorized Access Response Status:', rbacRes.statusCode);
      if (rbacRes.statusCode !== 403) {
        throw new Error(`Expected HTTP 403 for unauthorized certificate access, got ${rbacRes.statusCode}`);
      }
      console.log('   ✓ Security verified! Cross-employee certificate access blocked.');

      console.log('\n🎉 ALL CERTIFICATION FEATURE E2E TESTS PASSED PERFECTLY! 🎉');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('\n❌ E2E Test Error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runCertificationFeatureE2ETest();
