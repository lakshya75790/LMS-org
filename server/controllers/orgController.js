const bcrypt = require('bcryptjs');
const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { autoAssignMandatoryTrainings, autoAssignDeptRoleTrainings } = require('../services/trainingAssignmentService');
const { sendUserNotification, sendAdminNotification } = require('../services/notificationService');
const { logAuditAction } = require('../services/auditLogService');

const formatUserResponse = (user) => {
  if (!user) return null;
  const userObj = { ...user, _id: user.id };
  delete userObj.password;
  if (userObj.department) {
    userObj.departmentId = { ...userObj.department, _id: userObj.department.id };
  }
  if (userObj.organization) {
    userObj.organizationId = { ...userObj.organization, _id: userObj.organization.id };
  }
  return userObj;
};

/**
 * @desc    Create a new Department
 * @route   POST /api/org/departments
 * @access  Private (Organization Admin)
 */
const createDepartment = async (req, res, next) => {
  try {
    const { name, description, jobRoles } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    if (!name || !name.trim()) {
      throw new ApiError(400, 'Department name is required');
    }

    const cleanName = name.trim();

    const existingDep = await prisma.department.findFirst({
      where: {
        name: { equals: cleanName, mode: 'insensitive' },
        organizationId: orgId
      }
    });

    if (existingDep && existingDep.status === 'active') {
      throw new ApiError(400, `Department '${cleanName}' already exists. Please use a different name.`);
    }

    let department;
    if (existingDep && existingDep.status !== 'active') {
      department = await prisma.department.update({
        where: { id: existingDep.id },
        data: {
          name: cleanName,
          description: description || null,
          jobRoles: Array.isArray(jobRoles) ? jobRoles : [],
          status: 'active',
          createdAt: new Date()
        }
      });
    } else {
      department = await prisma.department.create({
        data: {
          name: cleanName,
          description: description || null,
          jobRoles: Array.isArray(jobRoles) ? jobRoles : [],
          organizationId: orgId,
          status: 'active'
        }
      });
    }

    logAuditAction(req.user, 'CREATE_DEPARTMENT', 'Department', department.id, `Created department ${department.name}`).catch(err => console.error('Audit log error in createDepartment:', err));

    res.status(201).json(new ApiResponse(201, { department: withId(department) }, 'Department created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all Departments for Organization
 * @route   GET /api/org/departments
 * @access  Private (Admin, Instructor, Employee)
 */
const getDepartments = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    const departments = await prisma.department.findMany({
      where: {
        organizationId: orgId,
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        description: true,
        jobRoles: true,
        organizationId: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(new ApiResponse(200, { departments: withId(departments) }, 'Departments retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Department
 * @route   PUT /api/org/departments/:id
 * @access  Private (Organization Admin)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const { name, description, jobRoles, status } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const depId = String(req.params.id);

    const department = await prisma.department.findFirst({
      where: {
        id: depId,
        organizationId: orgId
      }
    });

    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    if (name && name.trim()) {
      const cleanName = name.trim();
      const existingActive = await prisma.department.findFirst({
        where: {
          name: { equals: cleanName, mode: 'insensitive' },
          organizationId: orgId,
          status: 'active',
          id: { not: department.id }
        }
      });
      if (existingActive) {
        throw new ApiError(400, `Department '${cleanName}' already exists. Please use a different name.`);
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (jobRoles) updateData.jobRoles = Array.isArray(jobRoles) ? jobRoles : [];
    if (status) updateData.status = status;

    const updatedDepartment = await prisma.department.update({
      where: { id: department.id },
      data: updateData
    });

    logAuditAction(req.user, 'UPDATE_DEPARTMENT', 'Department', updatedDepartment.id, `Updated department ${updatedDepartment.name}`).catch(err => console.error('Audit log error in updateDepartment:', err));

    res.status(200).json(new ApiResponse(200, { department: withId(updatedDepartment) }, 'Department updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete/Deactivate Department
 * @route   DELETE /api/org/departments/:id
 * @access  Private (Organization Admin)
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const depId = String(req.params.id);

    const department = await prisma.department.findFirst({
      where: {
        id: depId,
        organizationId: orgId
      }
    });

    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    const deactivatedDepartment = await prisma.department.update({
      where: { id: department.id },
      data: { status: 'deactivated' }
    });

    logAuditAction(req.user, 'DEACTIVATE_DEPARTMENT', 'Department', deactivatedDepartment.id, `Deactivated department ${deactivatedDepartment.name}`).catch(err => console.error('Audit log error in deleteDepartment:', err));

    res.status(200).json(new ApiResponse(200, {}, 'Department deactivated successfully'));
  } catch (error) {
    next(error);
  }
};

const { checkAndReserveLicense } = require('../services/licenseService');

/**
 * @desc    Create Instructor (Only Admin can create)
 * @route   POST /api/org/instructors
 * @access  Private (Organization Admin)
 */
const createInstructor = async (req, res, next) => {
  try {
    const { name, email, password, departmentId } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    if (!name || !email || !password) {
      throw new ApiError(400, 'Please provide name, email, and password');
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() }
    });
    if (existingUser) {
      throw new ApiError(400, 'User with this email already exists');
    }

    if (departmentId) {
      const depId = String(departmentId);
      const dep = await prisma.department.findFirst({
        where: { id: depId, organizationId: orgId }
      });
      if (!dep) {
        throw new ApiError(404, 'Selected department does not exist in your organization');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profilePicture = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;

    const instructor = await prisma.$transaction(async (tx) => {
      const licenseReservation = await checkAndReserveLicense(orgId, tx);
      if (!licenseReservation.allowed) {
        throw new ApiError(400, 'All available licenses have been used. Please contact your administrator to add more licenses.');
      }

      return await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'Instructor',
          organizationId: orgId,
          departmentId: departmentId ? String(departmentId) : null,
          isProfileComplete: true,
          profilePicture
        },
        include: {
          department: { select: { id: true, name: true } }
        }
      });
    });

    const { sendAdminNotification } = require('../services/notificationService');
    Promise.all([
      logAuditAction(req.user, 'CREATE_INSTRUCTOR', 'User', instructor.id, `Created instructor ${instructor.name} (${instructor.email})`),
      sendAdminNotification(
        orgId,
        'INSTRUCTOR_ADDED',
        'Instructor Added',
        `A new instructor, ${instructor.name}, has been added to your organization.`,
        { entityType: 'User', entityId: instructor.id }
      )
    ]).catch(err => console.error('Background task error in createInstructor:', err));

    const userObj = formatUserResponse(instructor);

    res.status(201).json(new ApiResponse(201, { instructor: userObj }, 'Instructor account created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all Instructors
 * @route   GET /api/org/instructors
 * @access  Private (Organization Admin)
 */
const getInstructors = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    const instructors = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: 'Instructor'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        profilePicture: true,
        departmentId: true,
        organizationId: true,
        createdAt: true,
        department: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    });

    const formattedInstructors = instructors.map(formatUserResponse);

    res.status(200).json(new ApiResponse(200, { instructors: formattedInstructors }, 'Instructors retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create Additional Organization Admin
 * @route   POST /api/org/admins
 * @access  Private (Organization Admin)
 */
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    if (!name || !email || !password) {
      throw new ApiError(400, 'Please provide name, email, and password');
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() }
    });
    if (existingUser) {
      throw new ApiError(400, 'User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profilePicture = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;

    const admin = await prisma.$transaction(async (tx) => {
      const licenseReservation = await checkAndReserveLicense(orgId, tx);
      if (!licenseReservation.allowed) {
        throw new ApiError(400, 'All available licenses have been used. Please contact your administrator to add more licenses.');
      }

      return await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'Admin',
          organizationId: orgId,
          isProfileComplete: true,
          profilePicture
        }
      });
    });

    logAuditAction(req.user, 'CREATE_ADMIN', 'User', admin.id, `Created admin ${admin.name} (${admin.email})`).catch(err => console.error('Audit log error in createAdmin:', err));

    const userObj = formatUserResponse(admin);

    res.status(201).json(new ApiResponse(201, { admin: userObj }, 'Organization Admin created successfully'));
  } catch (error) {
    next(error);
  }
};

const { getOrgLicenseStats } = require('../services/licenseService');

/**
 * @desc    Get all Employees
 * @route   GET /api/org/employees
 * @access  Private (Organization Admin)
 */
const getEmployees = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    const [employees, licenseStats] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId: orgId,
          role: 'Employee'
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          jobRole: true,
          isProfileComplete: true,
          profilePicture: true,
          departmentId: true,
          organizationId: true,
          createdAt: true,
          department: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      getOrgLicenseStats(orgId)
    ]);

    const formattedEmployees = employees.map(formatUserResponse);

    res.status(200).json(new ApiResponse(200, { employees: formattedEmployees, licenseStats }, 'Employees retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Employee Profile (Department & Job Role Selection)
 * @route   PUT /api/org/profile
 * @access  Private (Employee)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { departmentId, jobRole } = req.body;
    const userId = String(req.user.id || req.user._id);
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const updateData = {};

    if (departmentId) {
      const depId = String(departmentId);
      const dep = await prisma.department.findFirst({
        where: { id: depId, organizationId: orgId }
      });
      if (!dep) {
        throw new ApiError(404, 'Selected department does not exist');
      }
      updateData.departmentId = depId;
    }

    if (jobRole) {
      updateData.jobRole = jobRole.trim();
    }

    const effectiveDepId = updateData.departmentId || user.departmentId;
    const effectiveJobRole = updateData.jobRole || user.jobRole;

    if (effectiveDepId && effectiveJobRole) {
      updateData.isProfileComplete = true;
    }

    const updatedUserRecord = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    if (updatedUserRecord.departmentId && updatedUserRecord.jobRole) {
      await autoAssignMandatoryTrainings(updatedUserRecord.id, updatedUserRecord.organizationId);
      await autoAssignDeptRoleTrainings(updatedUserRecord.id, updatedUserRecord.organizationId, updatedUserRecord.departmentId, updatedUserRecord.jobRole);
    }

    const finalUser = await prisma.user.findUnique({
      where: { id: updatedUserRecord.id },
      include: {
        department: { select: { id: true, name: true, jobRoles: true } },
        organization: { select: { id: true, name: true, code: true } }
      }
    });

    res.status(200).json(new ApiResponse(200, { user: formatUserResponse(finalUser) }, 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Activate / Deactivate User (Employee or Instructor)
 * @route   PUT /api/org/users/:id/status
 * @access  Private (Organization Admin)
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const targetUserId = String(req.params.id);

    if (!status || !['active', 'deactivated'].includes(status)) {
      throw new ApiError(400, 'Status is required and must be either "active" or "deactivated"');
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId: orgId
      }
    });

    if (!targetUser) {
      throw new ApiError(404, 'User not found in your organization');
    }

    if (targetUser.role === 'Admin') {
      throw new ApiError(400, 'Organization Admins cannot be deactivated or status modified through this feature');
    }

    if (targetUser.status === status) {
      return res.status(200).json(
        new ApiResponse(200, { user: formatUserResponse(targetUser) }, `User is already ${status}`)
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: { status }
    });

    const isDeactivating = status === 'deactivated';
    const actionMessage = isDeactivating ? 'deactivated' : 'activated';

    let userNotifType = isDeactivating ? 'ACCOUNT_LOCKED' : 'ACCOUNT_UNLOCKED';
    let adminNotifType = '';

    if (updatedUser.role === 'Employee') {
      adminNotifType = isDeactivating ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_ACTIVATED';
    } else if (updatedUser.role === 'Instructor') {
      adminNotifType = isDeactivating ? 'INSTRUCTOR_DEACTIVATED' : 'INSTRUCTOR_ACTIVATED';
    } else {
      adminNotifType = isDeactivating ? 'DEACTIVATE_USER' : 'ACTIVATE_USER';
    }

    // Send Notification & Audit logs asynchronously in background without blocking response
    Promise.all([
      sendUserNotification(
        updatedUser.id,
        orgId,
        updatedUser.role,
        userNotifType,
        isDeactivating ? 'Account Deactivated' : 'Account Activated',
        isDeactivating
          ? 'Your account has been deactivated by an administrator. Access to the system is currently blocked.'
          : 'Your account has been activated. You may now log in and access the system normally.',
        { entityType: 'User', entityId: updatedUser.id }
      ),
      sendAdminNotification(
        orgId,
        adminNotifType,
        `${updatedUser.role} Account ${isDeactivating ? 'Deactivated' : 'Activated'}`,
        `${updatedUser.role} "${updatedUser.name}" (${updatedUser.email}) was ${actionMessage} by Admin ${req.user.name}`,
        { entityType: 'User', entityId: updatedUser.id }
      ),
      logAuditAction(
        req.user,
        isDeactivating ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
        'User',
        updatedUser.id,
        `${isDeactivating ? 'Deactivated' : 'Activated'} ${updatedUser.role} user ${updatedUser.name} (${updatedUser.email})`
      )
    ]).catch(err => console.error('Background notification error in updateUserStatus:', err));

    res.status(200).json(
      new ApiResponse(200, { user: formatUserResponse(updatedUser) }, `User ${actionMessage} successfully`)
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  createInstructor,
  getInstructors,
  createAdmin,
  getEmployees,
  updateProfile,
  updateUserStatus
};
