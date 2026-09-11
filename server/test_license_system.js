require('dotenv').config();
const { prisma } = require('./config/prismaClient');
const bcrypt = require('bcryptjs');
const { getOrgLicenseStats, checkAndReserveLicense, ensureOrganizationLicensesValid } = require('./services/licenseService');
const { createOrganization, updateOrganization } = require('./controllers/superAdminController');
const { createInstructor, updateUserStatus } = require('./controllers/orgController');
const { registerEmployee } = require('./controllers/authController');

let mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('STARTING LICENSE SYSTEM INTEGRATION TESTS');
  console.log('----------------------------------------------------');

  const realSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SuperAdmin' }
  });

  const superAdminUser = realSuperAdmin || { id: 'super-admin-test-id', name: 'Test Super Admin', role: 'SuperAdmin' };
  const testOrgCode = `LIC-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const testAdminEmail = `lic_admin_${Date.now()}@test.com`;

  let testOrgId;
  let testOrgAdminId;

  try {
    // ----------------------------------------------------
    // TEST CASE 1: Super Admin -> Create Organization
    // ----------------------------------------------------
    console.log('\n[TEST 1] Creating new Organization with Total Licenses = 5...');
    const reqCreateOrg = {
      body: {
        name: 'License Test Org',
        code: testOrgCode,
        description: 'Test Org for License System',
        totalLicenses: 5,
        adminName: 'Test Org Admin',
        adminEmail: testAdminEmail,
        adminPassword: 'Password123!'
      },
      user: superAdminUser
    };
    const resCreateOrg = mockRes();
    await createOrganization(reqCreateOrg, resCreateOrg, (err) => { throw err; });

    const createdOrg = resCreateOrg.body.data.organization;
    testOrgId = createdOrg.id;
    testOrgAdminId = resCreateOrg.body.data.adminUser.id;

    const stats1 = await getOrgLicenseStats(testOrgId);
    console.log('Org Stats 1:', stats1);
    if (stats1.totalLicenses === 5 && stats1.usedLicenses === 1 && stats1.remainingLicenses === 4) {
      console.log('✅ TEST 1 PASSED: New Organization created with 5 total licenses, 1 consumed by Org Admin, 4 remaining.');
    } else {
      throw new Error(`TEST 1 FAILED: Expected total 5, used 1, remaining 4. Got ${JSON.stringify(stats1)}`);
    }

    // ----------------------------------------------------
    // TEST CASE 2: Fill Usage to 5 (Full Usage) & Verify Blocking
    // ----------------------------------------------------
    console.log('\n[TEST 2] Filling remaining 4 licenses (Creating 4 Instructors/Employees)...');
    const orgAdminUser = {
      id: testOrgAdminId,
      name: 'Test Org Admin',
      role: 'Admin',
      organizationId: testOrgId
    };

    for (let i = 1; i <= 4; i++) {
      const reqInst = {
        body: {
          name: `Instructor ${i}`,
          email: `inst_${i}_${Date.now()}@test.com`,
          password: 'Password123!'
        },
        user: orgAdminUser
      };
      const resInst = mockRes();
      await createInstructor(reqInst, resInst, (err) => { throw err; });
    }

    const stats2 = await getOrgLicenseStats(testOrgId);
    console.log('Org Stats 2 (Full Usage):', stats2);
    if (stats2.usedLicenses === 5 && stats2.remainingLicenses === 0) {
      console.log('✅ Full usage reached: 5 / 5 licenses consumed.');
    } else {
      throw new Error(`Expected used 5, remaining 0. Got ${JSON.stringify(stats2)}`);
    }

    // Try creating 6th user (Instructor creation when 0 available) -> Must fail
    console.log('Attempting to create 6th user via Instructor Creation API...');
    let instructorBlockedPassed = false;
    const reqInst6 = {
      body: {
        name: 'Instructor 6 Overflow',
        email: `inst_6_overflow_${Date.now()}@test.com`,
        password: 'Password123!'
      },
      user: orgAdminUser
    };
    const resInst6 = mockRes();
    await createInstructor(reqInst6, resInst6, (err) => {
      console.log('Received expected Instructor block error:', err.message);
      if (err.statusCode === 400 && err.message === 'All available licenses have been used. Please contact your administrator to add more licenses.') {
        instructorBlockedPassed = true;
      }
    });

    if (!instructorBlockedPassed) {
      throw new Error('TEST 2 FAILED: Instructor creation was not blocked with exact error message.');
    }

    // Try registering employee when 0 available -> Must fail & trigger admin notification
    console.log('Attempting to register 6th user via Public Employee Registration API...');
    let employeeBlockedPassed = false;
    const reqEmp6 = {
      body: {
        name: 'Employee 6 Overflow',
        email: `emp_6_overflow_${Date.now()}@test.com`,
        password: 'Password123!',
        orgCode: testOrgCode
      }
    };
    const resEmp6 = mockRes();
    await registerEmployee(reqEmp6, resEmp6, (err) => {
      console.log('Received expected Employee registration block error:', err.message);
      if (err.statusCode === 400 && err.message === 'All available licenses have been used. Please contact your administrator to add more licenses.') {
        employeeBlockedPassed = true;
      }
    });

    if (!employeeBlockedPassed) {
      throw new Error('TEST 2 FAILED: Employee registration was not blocked with exact error message.');
    }

    // Verify Notification to Org Admin was generated
    const adminNotification = await prisma.notification.findFirst({
      where: {
        recipientId: testOrgAdminId,
        title: 'License Limit Reached'
      }
    });

    if (adminNotification && adminNotification.message.includes('An employee attempted to register, but all available licenses for your organization have been used.')) {
      console.log('✅ Admin Notification verified:', adminNotification.title, '-', adminNotification.message);
    } else {
      throw new Error('TEST 2 FAILED: Organization Admin notification was not created or message did not match expected wording.');
    }

    console.log('✅ TEST 2 PASSED: Instructor creation & Employee registration both blocked with unified message & Admin notified.');

    // ----------------------------------------------------
    // TEST CASE 3: License Increase (5 -> 8)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Super Admin increasing total licenses from 5 to 8...');
    const reqUpdate8 = {
      params: { id: testOrgId },
      body: { totalLicenses: 8 }
    };
    const resUpdate8 = mockRes();
    await updateOrganization(reqUpdate8, resUpdate8, (err) => { throw err; });

    const stats3 = await getOrgLicenseStats(testOrgId);
    console.log('Org Stats 3:', stats3);
    if (stats3.totalLicenses === 8 && stats3.usedLicenses === 5 && stats3.remainingLicenses === 3) {
      console.log('✅ TEST 3 PASSED: License count successfully increased to 8 (Remaining = 3).');
    } else {
      throw new Error(`TEST 3 FAILED: Expected total 8, used 5, remaining 3. Got ${JSON.stringify(stats3)}`);
    }

    // ----------------------------------------------------
    // TEST CASE 4: Invalid Reduction (Used = 5, trying Total = 2)
    // ----------------------------------------------------
    console.log('\n[TEST 4] Attempting invalid license reduction from 8 to 2 (Used = 5)...');
    let invalidReductionPassed = false;
    const reqUpdate2 = {
      params: { id: testOrgId },
      body: { totalLicenses: 2 }
    };
    const resUpdate2 = mockRes();
    await updateOrganization(reqUpdate2, resUpdate2, (err) => {
      console.log('Received expected reduction error:', err.message);
      if (err.statusCode === 400 && err.message.includes('License limit cannot be reduced below the number of licenses currently in use')) {
        invalidReductionPassed = true;
      }
    });

    if (!invalidReductionPassed) {
      throw new Error('TEST 4 FAILED: License reduction below currently used count was not rejected.');
    }
    console.log('✅ TEST 4 PASSED: Invalid reduction below used count rejected with exact error message.');

    // ----------------------------------------------------
    // TEST CASE 5: Valid Reduction (Used = 5, Total = 8 -> 5)
    // ----------------------------------------------------
    console.log('\n[TEST 5] Reducing licenses from 8 back to 5 (Used = 5)...');
    const reqUpdate5 = {
      params: { id: testOrgId },
      body: { totalLicenses: 5 }
    };
    const resUpdate5 = mockRes();
    await updateOrganization(reqUpdate5, resUpdate5, (err) => { throw err; });

    const stats5 = await getOrgLicenseStats(testOrgId);
    console.log('Org Stats 5:', stats5);
    if (stats5.totalLicenses === 5 && stats5.usedLicenses === 5 && stats5.remainingLicenses === 0) {
      console.log('✅ TEST 5 PASSED: Valid license reduction from 8 to 5 allowed.');
    } else {
      throw new Error(`TEST 5 FAILED: Expected total 5, used 5, remaining 0. Got ${JSON.stringify(stats5)}`);
    }

    // ----------------------------------------------------
    // TEST CASE 6: Existing Organization Data Migration Helper
    // ----------------------------------------------------
    console.log('\n[TEST 6] Testing ensureOrganizationLicensesValid() migration strategy...');
    await ensureOrganizationLicensesValid();
    const stats6 = await getOrgLicenseStats(testOrgId);
    if (stats6.totalLicenses >= stats6.usedLicenses) {
      console.log(`✅ TEST 6 PASSED: Migration check passed. Total: ${stats6.totalLicenses}, Used: ${stats6.usedLicenses}`);
    } else {
      throw new Error('TEST 6 FAILED: Total licenses is less than used licenses after migration!');
    }

    // ----------------------------------------------------
    // TEST CASE 7: License Release on User Deactivation
    // ----------------------------------------------------
    console.log('\n[TEST 7] Deactivating an active user to release license...');
    const instructorsList = await prisma.user.findMany({
      where: { organizationId: testOrgId, role: 'Instructor', status: 'active' },
      take: 1
    });

    const targetUser = instructorsList[0];
    const reqDeactivate = {
      params: { id: targetUser.id },
      body: { status: 'deactivated' },
      user: orgAdminUser
    };
    const resDeactivate = mockRes();
    await updateUserStatus(reqDeactivate, resDeactivate, (err) => { throw err; });

    const stats7 = await getOrgLicenseStats(testOrgId);
    console.log('Org Stats 7 (After Deactivation):', stats7);
    if (stats7.usedLicenses === 4 && stats7.remainingLicenses === 1) {
      console.log('✅ TEST 7 PASSED: License released upon user deactivation (Used: 4, Remaining: 1).');
    } else {
      throw new Error(`TEST 7 FAILED: Expected used 4, remaining 1. Got ${JSON.stringify(stats7)}`);
    }

    // ----------------------------------------------------
    // TEST CASE 8: Cleanup Test Organization Data
    // ----------------------------------------------------
    console.log('\n[TEST 8] Cleaning up test organization data from DB...');
    await prisma.organization.delete({ where: { id: testOrgId } });
    console.log('✅ TEST 8 PASSED: Test organization data cleaned up cleanly.');

    console.log('\n----------------------------------------------------');
    console.log('🎉 ALL 8 LICENSE SYSTEM TEST CASES PASSED SUCCESSFULLY!');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    if (testOrgId) {
      try { await prisma.organization.delete({ where: { id: testOrgId } }); } catch (e) {}
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
