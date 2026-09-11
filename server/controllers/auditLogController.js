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

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true, profilePicture: true, role: true } }
      },
      orderBy: { timestamp: 'desc' },
      take: 300
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
