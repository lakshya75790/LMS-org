const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prismaClient');

const ensureSuperAdminExists = async () => {
  try {
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SuperAdmin' }
    });

    if (!existingSuperAdmin) {
      const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@it360.com';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdminPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);

      const superAdmin = await prisma.user.create({
        data: {
          name: 'System Super Admin',
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'SuperAdmin',
          organizationId: null,
          isProfileComplete: true,
          status: 'active'
        }
      });
      console.log(`[SEED] Created default SuperAdmin: ${superAdmin.email}`);
    }
  } catch (error) {
    console.error('[SEED ERROR] Failed to seed SuperAdmin:', error.message);
  }
};

module.exports = ensureSuperAdminExists;
