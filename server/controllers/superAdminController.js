const bcrypt = require('bcryptjs');
const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// @desc    Create a new Organization with an Initial Org Admin
// @route   POST /api/super-admin/organizations
// @access  Private (SuperAdmin)
const createOrganization = async (req, res, next) => {
  try {
    const { name, code, description, adminName, adminEmail, adminPassword, totalLicenses } = req.body;

    if (!name || !adminName || !adminEmail || !adminPassword) {
      throw new ApiError(400, 'Organization name, Admin name, email, and password are required');
    }

    let totalLicensesNum = 5;
    if (totalLicenses !== undefined && totalLicenses !== null && totalLicenses !== '') {
      const parsed = Number(totalLicenses);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ApiError(400, 'Total Licenses must be a valid positive integer (at least 1)');
      }
      totalLicensesNum = parsed;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail.toLowerCase() }
    });
    if (existingUser) {
      throw new ApiError(400, 'An account with this email address already exists');
    }

    const orgCode = code
      ? code.trim().toUpperCase()
      : `ORG-${Math.floor(1000 + Math.random() * 9000)}`;

    const existingOrg = await prisma.organization.findUnique({
      where: { code: orgCode }
    });
    if (existingOrg) {
      throw new ApiError(400, 'An organization with this code already exists');
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        code: orgCode,
        description: description ? description.trim() : null,
        totalLicenses: totalLicensesNum,
        status: 'ACTIVE'
      }
    });

    const adminUser = await prisma.user.create({
      data: {
        name: adminName.trim(),
        email: adminEmail.toLowerCase().trim(),
        password: hashedPassword,
        role: 'Admin',
        organizationId: organization.id,
        isProfileComplete: true,
        status: 'active'
      }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: req.user.id,
        userName: req.user.name || 'System Super Admin',
        userRole: 'SuperAdmin',
        action: 'CREATE_ORGANIZATION',
        details: `Organization "${organization.name}" (${organization.code}) created with ${totalLicensesNum} total licenses and Admin "${adminUser.email}"`
      }
    });

    res.status(201).json(
      new ApiResponse(
        201,
        {
          organization: withId(organization),
          adminUser: withId(adminUser)
        },
        'Organization and initial Admin created successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Get All Organizations with user counts & server-side pagination
// @route   GET /api/super-admin/organizations
// @access  Private (SuperAdmin)
const getAllOrganizations = async (req, res, next) => {
  const startTime = performance.now();
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    const whereClause = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const dbStart = performance.now();

    const [orgs, totalCount, activeOrgCount, totalUsersCount, searchGlobalCount] = await Promise.all([
      prisma.organization.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          status: true,
          totalLicenses: true,
          createdAt: true,
          updatedAt: true,
          users: {
            where: { role: 'Admin' },
            select: { id: true, name: true, email: true },
            take: 1
          },
          _count: {
            select: { departments: true, trainings: true }
          }
        }
      }),
      prisma.organization.count({
        where: whereClause
      }),
      prisma.organization.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.user.count({
        where: { role: { not: 'SuperAdmin' } }
      }),
      search ? prisma.organization.count() : Promise.resolve(null)
    ]);

    const orgIds = orgs.map(o => o.id);
    const activeUserCounts = orgIds.length > 0 ? await prisma.user.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: orgIds },
        role: { in: ['Admin', 'Instructor', 'Employee'] },
        status: 'active'
      },
      _count: { id: true }
    }) : [];

    const countMap = new Map();
    activeUserCounts.forEach(c => countMap.set(c.organizationId, c._count.id));

    const globalOrgCount = search ? searchGlobalCount : totalCount;
    const dbTime = (performance.now() - dbStart).toFixed(2);

    const formattedOrgs = orgs.map(org => {
      const transformed = withId(org);
      const total = typeof org.totalLicenses === 'number' && !isNaN(org.totalLicenses) ? org.totalLicenses : 5;
      const used = countMap.get(org.id) || 0;
      const primaryAdmin = org.users && org.users[0] ? org.users[0] : null;
      return {
        ...transformed,
        totalLicenses: total,
        usedLicenses: used,
        remainingLicenses: Math.max(0, total - used),
        departmentCount: org._count.departments,
        trainingCount: org._count.trainings,
        adminEmail: primaryAdmin ? primaryAdmin.email : '',
        adminName: primaryAdmin ? primaryAdmin.name : ''
      };
    });

    const totalPages = Math.ceil(totalCount / limit) || 1;
    const totalTime = (performance.now() - startTime).toFixed(2);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PERF] GET /api/super-admin/organizations - DB: ${dbTime}ms, Total: ${totalTime}ms`);
    }

    res.status(200).json(
      new ApiResponse(
        200,
        {
          organizations: formattedOrgs,
          stats: {
            totalOrganizations: globalOrgCount,
            activeOrganizations: activeOrgCount,
            totalPlatformUsers: totalUsersCount
          },
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages
          }
        },
        'Organizations retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Update Organization Details
// @route   PUT /api/super-admin/organizations/:id
// @access  Private (SuperAdmin)
const updateOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, totalLicenses, adminEmail, adminName } = req.body;

    const existingOrg = await prisma.organization.findUnique({
      where: { id }
    });
    if (!existingOrg) {
      throw new ApiError(404, 'Organization not found');
    }

    if (code && code.trim().toUpperCase() !== existingOrg.code) {
      const codeCheck = await prisma.organization.findUnique({
        where: { code: code.trim().toUpperCase() }
      });
      if (codeCheck) {
        throw new ApiError(400, 'Another organization already uses this code');
      }
    }

    let updatedTotalLicenses;
    if (totalLicenses !== undefined && totalLicenses !== null && totalLicenses !== '') {
      const parsed = Number(totalLicenses);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ApiError(400, 'Total Licenses must be a valid positive integer (at least 1)');
      }

      const currentlyUsedLicenses = await prisma.user.count({
        where: {
          organizationId: id,
          role: { in: ['Admin', 'Instructor', 'Employee'] },
          status: 'active'
        }
      });

      if (parsed < currentlyUsedLicenses) {
        throw new ApiError(400, `License limit cannot be reduced below the number of licenses currently in use. ${currentlyUsedLicenses} licenses are currently in use.`);
      }

      updatedTotalLicenses = parsed;
    }

    // Handle Organization Admin Email / Name Update
    if (adminEmail !== undefined && adminEmail !== null && String(adminEmail).trim() !== '') {
      const normalizedEmail = String(adminEmail).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        throw new ApiError(400, 'Please enter a valid email address.');
      }

      const orgAdmin = await prisma.user.findFirst({
        where: { organizationId: id, role: 'Admin' },
        orderBy: { createdAt: 'asc' }
      });

      if (orgAdmin) {
        if (normalizedEmail !== orgAdmin.email) {
          const existingUser = await prisma.user.findFirst({
            where: {
              email: normalizedEmail,
              id: { not: orgAdmin.id }
            }
          });

          if (existingUser) {
            throw new ApiError(400, 'This email address is already in use. Please use a different email.');
          }

          await prisma.user.update({
            where: { id: orgAdmin.id },
            data: {
              email: normalizedEmail,
              ...(adminName && String(adminName).trim() !== '' && { name: String(adminName).trim() })
            }
          });
        } else if (adminName && String(adminName).trim() !== '' && String(adminName).trim() !== orgAdmin.name) {
          await prisma.user.update({
            where: { id: orgAdmin.id },
            data: { name: String(adminName).trim() }
          });
        }
      }
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(updatedTotalLicenses !== undefined && { totalLicenses: updatedTotalLicenses })
      }
    });

    res.status(200).json(
      new ApiResponse(
        200,
        { organization: withId(updatedOrg) },
        'Organization updated successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Organization Active/Inactive Status
// @route   PUT /api/super-admin/organizations/:id/status
// @access  Private (SuperAdmin)
const toggleOrganizationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const normalizedStatus = String(status || '').trim().toUpperCase();

    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
      throw new ApiError(400, 'Status must be ACTIVE or INACTIVE');
    }

    const existingOrg = await prisma.organization.findUnique({
      where: { id: String(id) }
    });
    if (!existingOrg) {
      throw new ApiError(404, 'Organization not found');
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: String(id) },
      data: { status: normalizedStatus }
    });

    res.status(200).json(
      new ApiResponse(
        200,
        { organization: withId(updatedOrg) },
        `Organization status updated to ${normalizedStatus}`
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrganization,
  getAllOrganizations,
  updateOrganization,
  toggleOrganizationStatus
};
