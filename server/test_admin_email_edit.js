require('dotenv').config();
const { prisma } = require('./config/prismaClient');
const bcrypt = require('bcryptjs');
const { createOrganization, updateOrganization, getAllOrganizations } = require('./controllers/superAdminController');

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

async function runEmailEditTests() {
  console.log('----------------------------------------------------');
  console.log('STARTING ORG ADMIN EMAIL EDIT FEATURE TESTS');
  console.log('----------------------------------------------------');

  const realSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SuperAdmin' }
  });
  const superAdminUser = realSuperAdmin || { id: 'super-admin-test-id', name: 'Test Super Admin', role: 'SuperAdmin' };

  const testOrgCode = `EMAIL-EDIT-${Math.floor(1000 + Math.random() * 9000)}`;
  const initialAdminEmail = `original_admin_${Date.now()}@test.com`;
  const originalPassword = 'SecretPassword123!';

  let testOrgId;
  let testOrgAdminId;

  try {
    // Setup: Provision Organization & Admin
    console.log('\n[SETUP] Creating test organization and admin...');
    const reqCreate = {
      body: {
        name: 'Email Edit Test Org',
        code: testOrgCode,
        totalLicenses: 5,
        adminName: 'Original Admin',
        adminEmail: initialAdminEmail,
        adminPassword: originalPassword
      },
      user: superAdminUser
    };
    const resCreate = mockRes();
    await createOrganization(reqCreate, resCreate, (err) => { throw err; });

    testOrgId = resCreate.body.data.organization.id;
    testOrgAdminId = resCreate.body.data.adminUser.id;
    const initialPasswordHash = resCreate.body.data.adminUser.password;

    console.log('Created Org ID:', testOrgId);
    console.log('Created Admin Email:', initialAdminEmail);

    // ----------------------------------------------------
    // TEST CASE 5: Fetch Organization and verify adminEmail is included
    // ----------------------------------------------------
    console.log('\n[TEST 5] Verifying getAllOrganizations includes adminEmail...');
    const reqGetAll = { query: { page: 1, limit: 50, search: testOrgCode } };
    const resGetAll = mockRes();
    await getAllOrganizations(reqGetAll, resGetAll, (err) => { throw err; });

    const fetchedOrgs = resGetAll.body.data.organizations;
    const matchedOrg = fetchedOrgs.find(o => o.id === testOrgId);

    if (matchedOrg && matchedOrg.adminEmail === initialAdminEmail) {
      console.log('✅ TEST 5 PASSED: Organization directory response contains correct adminEmail:', matchedOrg.adminEmail);
    } else {
      throw new Error(`TEST 5 FAILED: Expected adminEmail ${initialAdminEmail}, got ${matchedOrg?.adminEmail}`);
    }

    // ----------------------------------------------------
    // TEST CASE 2: Invalid Email Format
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing Invalid Email Format update...');
    let invalidEmailPassed = false;
    const reqInvalid = {
      params: { id: testOrgId },
      body: { adminEmail: 'not-an-email-address' }
    };
    const resInvalid = mockRes();
    await updateOrganization(reqInvalid, resInvalid, (err) => {
      console.log('Received expected invalid email error:', err.message);
      if (err.statusCode === 400 && err.message.includes('valid email')) {
        invalidEmailPassed = true;
      }
    });

    if (!invalidEmailPassed) {
      throw new Error('TEST 2 FAILED: Invalid email format was not rejected.');
    }
    console.log('✅ TEST 2 PASSED: Invalid email format rejected with 400 error.');

    // ----------------------------------------------------
    // TEST CASE 3: Duplicate Email (email taken by another user)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Creating secondary user and attempting to steal their email...');
    const otherUserEmail = `other_user_${Date.now()}@test.com`;
    const otherUser = await prisma.user.create({
      data: {
        name: 'Other User',
        email: otherUserEmail,
        password: 'password123',
        role: 'Employee',
        organizationId: testOrgId
      }
    });

    let duplicateEmailPassed = false;
    const reqDuplicate = {
      params: { id: testOrgId },
      body: { adminEmail: otherUserEmail }
    };
    const resDuplicate = mockRes();
    await updateOrganization(reqDuplicate, resDuplicate, (err) => {
      console.log('Received expected duplicate email error:', err.message);
      if (err.statusCode === 400 && (err.message.includes('already in use') || err.message.includes('already exists'))) {
        duplicateEmailPassed = true;
      }
    });

    if (!duplicateEmailPassed) {
      throw new Error('TEST 3 FAILED: Duplicate email was not rejected.');
    }
    console.log('✅ TEST 3 PASSED: Duplicate email rejected with 400 error.');

    // Cleanup secondary user
    await prisma.user.delete({ where: { id: otherUser.id } });

    // ----------------------------------------------------
    // TEST CASE 4: Same Email (Submitting without changing email)
    // ----------------------------------------------------
    console.log('\n[TEST 4] Updating organization with unchanged admin email...');
    const reqSame = {
      params: { id: testOrgId },
      body: { name: 'Email Edit Test Org Updated', adminEmail: initialAdminEmail }
    };
    const resSame = mockRes();
    await updateOrganization(reqSame, resSame, (err) => { throw err; });

    const adminCheckSame = await prisma.user.findUnique({ where: { id: testOrgAdminId } });
    if (adminCheckSame.email === initialAdminEmail && adminCheckSame.password === initialPasswordHash) {
      console.log('✅ TEST 4 PASSED: Submitting same email succeeded without altering user email or password.');
    } else {
      throw new Error('TEST 4 FAILED: Same email update modified user state unexpectedly.');
    }

    // ----------------------------------------------------
    // TEST CASE 1: Valid Email Change & Password Preservation
    // ----------------------------------------------------
    console.log('\n[TEST 1] Changing Organization Admin email to new valid address...');
    const newAdminEmail = `updated_admin_${Date.now()}@test.com`;
    const reqChange = {
      params: { id: testOrgId },
      body: { adminEmail: newAdminEmail }
    };
    const resChange = mockRes();
    await updateOrganization(reqChange, resChange, (err) => { throw err; });

    const adminAfterChange = await prisma.user.findUnique({ where: { id: testOrgAdminId } });

    console.log('Updated Admin Email in DB:', adminAfterChange.email);
    console.log('Password hash before change:', initialPasswordHash);
    console.log('Password hash after change :', adminAfterChange.password);

    if (adminAfterChange.email !== newAdminEmail.toLowerCase()) {
      throw new Error(`TEST 1 FAILED: Expected email ${newAdminEmail}, got ${adminAfterChange.email}`);
    }

    if (adminAfterChange.password !== initialPasswordHash) {
      throw new Error('TEST 1 FAILED: Password hash was modified or overwritten!');
    }

    // Verify original password still verifies against password hash
    const isPasswordValid = await bcrypt.compare(originalPassword, adminAfterChange.password);
    if (!isPasswordValid) {
      throw new Error('TEST 1 FAILED: Original password no longer matches user password hash!');
    }

    console.log('✅ TEST 1 PASSED: Admin email updated, password hash strictly preserved, login with original password verified!');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n[CLEANUP] Cleaning up test organization data...');
    await prisma.organization.delete({ where: { id: testOrgId } });
    console.log('✅ CLEANUP PASSED: Test data cleaned up.');

    console.log('\n----------------------------------------------------');
    console.log('🎉 ALL ORG ADMIN EMAIL EDIT TESTS PASSED SUCCESSFULLY!');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    if (testOrgId) {
      try { await prisma.organization.delete({ where: { id: testOrgId } }); } catch (e) {}
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEmailEditTests();
