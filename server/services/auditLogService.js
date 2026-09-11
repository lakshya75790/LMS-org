const { prisma } = require('../config/prismaClient');

const logAuditAction = async (user, action, targetType = null, targetId = null, details = '') => {
  try {
    if (!user) return;

    const userId = user.id || user._id;
    const organizationId = user.organizationId ? (user.organizationId.id || user.organizationId._id || user.organizationId) : null;

    if (!userId || !organizationId) return;

    let userName = user.name;
    if (!userName) {
      const dbUser = await prisma.user.findUnique({
        where: { id: String(userId) },
        select: { name: true }
      });
      userName = dbUser?.name;
    }

    if (!userName) return;

    await prisma.auditLog.create({
      data: {
        userId: String(userId),
        userName: String(userName),
        userRole: user.role,
        organizationId: String(organizationId),
        action,
        targetType: targetType ? String(targetType) : null,
        targetId: targetId ? String(targetId) : null,
        details
      }
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};

module.exports = {
  logAuditAction
};
