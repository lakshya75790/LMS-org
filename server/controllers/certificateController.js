const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const {
  DEFAULT_TEMPLATE,
  getOrCreateTemplateSettings,
  generateCertificateForAssignment,
  getBackfillEligible: getBackfillEligibleService,
  backfillMissingCertificates: backfillMissingCertificatesService
} = require('../services/certificateService');

/**
 * @desc    Get All Certificates Earned by Currently Logged-in Employee
 * @route   GET /api/certificates/my-certificates
 * @access  Private (Employee)
 */
const getMyCertificates = async (req, res, next) => {
  try {
    const userId = String(req.user.id || req.user._id);

    const certificates = await prisma.certificate.findMany({
      where: { employeeId: userId },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: { select: { id: true, name: true } } }
        },
        training: { select: { id: true, title: true, description: true } },
        organization: { select: { id: true, name: true, code: true } }
      },
      orderBy: { completionDate: 'desc' }
    });

    res.status(200).json(
      new ApiResponse(200, { certificates: withId(certificates) }, 'Certificates retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get All Organization Certificates for Organization Admin
 * @route   GET /api/certificates/org-certificates
 * @access  Private (Admin, SuperAdmin)
 */
const getOrgCertificates = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId);
    const { search, departmentId } = req.query;

    const whereClause = { organizationId: orgId };

    if (departmentId && departmentId !== 'all') {
      whereClause.employee = { departmentId: String(departmentId) };
    }

    if (search && search.trim() !== '') {
      const query = search.trim();
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { certificateId: { contains: query, mode: 'insensitive' } },
            { employee: { name: { contains: query, mode: 'insensitive' } } },
            { training: { title: { contains: query, mode: 'insensitive' } } }
          ]
        }
      ];
    }

    const certificates = await prisma.certificate.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: { select: { id: true, name: true } } }
        },
        training: { select: { id: true, title: true } },
        organization: { select: { id: true, name: true, code: true } }
      },
      orderBy: { completionDate: 'desc' }
    });

    res.status(200).json(
      new ApiResponse(200, { certificates: withId(certificates) }, 'Organization certificates retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Certificates for Trainings Created by Instructor
 * @route   GET /api/certificates/instructor-certificates
 * @access  Private (Instructor)
 */
const getInstructorCertificates = async (req, res, next) => {
  try {
    const userId = String(req.user.id || req.user._id);

    const certificates = await prisma.certificate.findMany({
      where: {
        training: { createdBy: userId }
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: { select: { id: true, name: true } } }
        },
        training: { select: { id: true, title: true } },
        organization: { select: { id: true, name: true, code: true } }
      },
      orderBy: { completionDate: 'desc' }
    });

    res.status(200).json(
      new ApiResponse(200, { certificates: withId(certificates) }, 'Instructor course certificates retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Single Certificate by ID / Certificate ID
 * @route   GET /api/certificates/:id
 * @access  Private
 */
const getCertificateById = async (req, res, next) => {
  try {
    const certParam = String(req.params.id);
    const userId = String(req.user.id || req.user._id);
    const userRole = req.user.role;
    const userOrgId = req.user.organizationId ? String(req.user.organizationId) : null;

    let certificate = await prisma.certificate.findFirst({
      where: {
        OR: [
          { id: certParam },
          { certificateId: certParam }
        ]
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: { select: { id: true, name: true } } }
        },
        training: { select: { id: true, title: true, description: true, createdBy: true } },
        organization: { select: { id: true, name: true, code: true } }
      }
    });

    if (!certificate) {
      throw new ApiError(404, 'Certificate not found');
    }

    // Role-based Authorization check
    if (userRole === 'Employee' && certificate.employeeId !== userId) {
      throw new ApiError(403, 'You are not authorized to view this certificate');
    }

    if (userRole === 'Instructor' && certificate.training?.createdBy !== userId) {
      throw new ApiError(403, 'You are not authorized to view certificates for this training');
    }

    if (userRole === 'Admin' && certificate.organizationId !== userOrgId) {
      throw new ApiError(403, 'You are not authorized to access another organization\'s certificate');
    }

    res.status(200).json(
      new ApiResponse(200, { certificate: withId(certificate) }, 'Certificate details retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Organization Certificate Template Settings
 * @route   GET /api/certificates/template
 * @access  Private (Admin)
 */
const getTemplateSettings = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId);

    const template = await getOrCreateTemplateSettings(orgId);

    res.status(200).json(
      new ApiResponse(200, { template }, 'Certificate template settings retrieved')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Organization Certificate Template Settings
 * @route   PUT /api/certificates/template
 * @access  Private (Admin)
 */
const updateTemplateSettings = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId);
    const {
      title,
      primaryColor,
      accentColor,
      fontFamily,
      borderStyle,
      layoutStyle,
      logoUrl,
      logoPublicId,
      logoPosition,
      logoWidth,
      signatureUrl,
      signaturePublicId,
      signatureName
    } = req.body;

    let template = await prisma.certificateTemplate.findUnique({
      where: { organizationId: orgId }
    });

    const updateData = {};
    if (title !== undefined) updateData.title = String(title).trim() || DEFAULT_TEMPLATE.title;
    if (primaryColor !== undefined) updateData.primaryColor = String(primaryColor).trim();
    if (accentColor !== undefined) updateData.accentColor = String(accentColor).trim();
    if (fontFamily !== undefined) updateData.fontFamily = String(fontFamily).trim();
    if (borderStyle !== undefined) updateData.borderStyle = String(borderStyle).trim();
    if (layoutStyle !== undefined) updateData.layoutStyle = String(layoutStyle).trim();

    if (logoUrl !== undefined) updateData.logoUrl = logoUrl ? String(logoUrl).trim() : null;
    if (logoPublicId !== undefined) updateData.logoPublicId = logoPublicId ? String(logoPublicId).trim() : null;
    if (logoPosition !== undefined) updateData.logoPosition = String(logoPosition).trim();
    if (logoWidth !== undefined) updateData.logoWidth = Number(logoWidth) || 130;
    if (signatureUrl !== undefined) updateData.signatureUrl = signatureUrl ? String(signatureUrl).trim() : null;
    if (signaturePublicId !== undefined) updateData.signaturePublicId = signaturePublicId ? String(signaturePublicId).trim() : null;
    if (signatureName !== undefined) updateData.signatureName = String(signatureName).trim();

    if (!template) {
      template = await prisma.certificateTemplate.create({
        data: {
          organizationId: orgId,
          ...DEFAULT_TEMPLATE,
          ...updateData
        }
      });
    } else {
      template = await prisma.certificateTemplate.update({
        where: { id: template.id },
        data: updateData
      });
    }

    res.status(200).json(
      new ApiResponse(200, { template: withId(template) }, 'Certificate template settings updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset Organization Certificate Template Settings to Defaults
 * @route   POST /api/certificates/template/reset
 * @access  Private (Admin)
 */
const resetTemplateSettings = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId);

    let template = await prisma.certificateTemplate.findUnique({
      where: { organizationId: orgId }
    });

    if (template) {
      template = await prisma.certificateTemplate.update({
        where: { id: template.id },
        data: DEFAULT_TEMPLATE
      });
    } else {
      template = await prisma.certificateTemplate.create({
        data: {
          organizationId: orgId,
          ...DEFAULT_TEMPLATE
        }
      });
    }

    res.status(200).json(
      new ApiResponse(200, { template: withId(template) }, 'Certificate template settings reset to default values')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Count and List of Completed Trainings Missing Certificates for Backfill
 * @route   GET /api/certificates/backfill-eligible
 * @access  Private (Admin)
 */
const getBackfillEligible = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId);
    const result = await getBackfillEligibleService(orgId);

    res.status(200).json(
      new ApiResponse(200, result, 'Backfill eligible count retrieved')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger Backfill to Generate Missing Certificates for Past Completed Trainings
 * @route   POST /api/certificates/backfill
 * @access  Private (Admin)
 */
const backfillCertificates = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId);
    const result = await backfillMissingCertificatesService(orgId);

    res.status(200).json(
      new ApiResponse(
        200,
        result,
        result.count > 0
          ? `Successfully generated ${result.count} missing certificates`
          : 'No missing certificates to generate'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyCertificates,
  getOrgCertificates,
  getInstructorCertificates,
  getCertificateById,
  getTemplateSettings,
  updateTemplateSettings,
  resetTemplateSettings,
  getBackfillEligible,
  backfillCertificates
};
