const { prisma, withId } = require('../config/prismaClient');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get Organization Audit Logs
 * @route   GET /api/audit-logs
 * @access  Private (Organization Admin)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const limit = Math.max(1, Math.min(300, parseInt(req.query.limit, 10) || 100));

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        userId: true,
        userName: true,
        userRole: true,
        organizationId: true,
        action: true,
        targetType: true,
        targetId: true,
        details: true,
        timestamp: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const auditLogs = logs.map(log => {
      const transformed = withId(log);
      if (transformed.user) transformed.userId = transformed.user;
      return transformed;
    });

    res.status(200).json(new ApiResponse(200, { auditLogs }, 'Audit logs retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs
};
