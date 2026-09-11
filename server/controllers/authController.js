let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}
const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const generateTokenAndSetCookie = require('../utils/generateToken');
const {
  autoAssignMandatoryTrainings,
  autoAssignDeptRoleTrainings,
  autoAssignRulesToNewEmployee
} = require('../services/trainingAssignmentService');
const { logAuditAction } = require('../services/auditLogService');
const { getCloudinary } = require('../config/cloudinary');

const getDefaultDiceBearAvatar = (name) => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}`;
};

const formatUserResponse = (user) => {
  if (!user) return null;
  const userObj = { ...user, _id: user.id };
  delete userObj.password;
  if (userObj.organization) {
    userObj.organizationId = { ...userObj.organization, _id: userObj.organization.id };
  }
  if (userObj.department) {
    userObj.departmentId = { ...userObj.department, _id: userObj.department.id };
  }
  return userObj;
};

/**
 * @desc    Initial Setup for Organization + Admin
 * @route   POST /api/auth/setup-org
 * @access  Public
 */
const setupOrganization = async (req, res, next) => {
  try {
    const { orgName, orgCode, adminName, adminEmail, adminPassword } = req.body;

    if (!orgName || !adminName || !adminEmail || !adminPassword) {
      throw new ApiError(400, 'Please provide all required fields (orgName, adminName, adminEmail, adminPassword)');
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: adminEmail.toLowerCase() }
    });
    if (existingUser) {
      throw new ApiError(400, 'User with this email already exists');
    }

    // Auto generate code if not provided
    let finalCode = orgCode ? orgCode.toUpperCase().trim() : null;
    if (!finalCode && orgName) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const cleanName = orgName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
      finalCode = `${cleanName}-${randomSuffix}`;
    }

    const existingOrg = await prisma.organization.findUnique({
      where: { code: finalCode }
    });
    if (existingOrg) {
      throw new ApiError(400, 'Organization code already exists. Please choose a different organization code.');
    }

    const organization = await prisma.organization.create({
      data: {
        name: orgName.trim(),
        code: finalCode
      }
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const profilePicture = getDefaultDiceBearAvatar(adminName);

    const admin = await prisma.user.create({
      data: {
        name: adminName.trim(),
        email: adminEmail.toLowerCase().trim(),
        password: hashedPassword,
        role: 'Admin',
        organizationId: organization.id,
        isProfileComplete: true,
        profilePicture
      }
    });

    generateTokenAndSetCookie(res, admin.id, admin.role, admin.organizationId, admin.name);

    const userObj = formatUserResponse(admin);

    res.status(201).json(
      new ApiResponse(
        201,
        { user: userObj, organization: withId(organization) },
        'Organization and Organization Admin setup completed successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

const { checkAndReserveLicense } = require('../services/licenseService');

/**
 * @desc    Public Employee Registration
 * @route   POST /api/auth/register-employee
 * @access  Public
 */
const registerEmployee = async (req, res, next) => {
  try {
    const { name, email, password, orgCode } = req.body;

    if (!name || !email || !password || !orgCode) {
      throw new ApiError(400, 'Please provide name, email, password, and organization code');
    }

    const organization = await prisma.organization.findUnique({
      where: { code: orgCode.toUpperCase().trim() }
    });
    if (!organization) {
      throw new ApiError(404, 'Organization not found with the provided code');
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() }
    });
    if (existingUser) {
      throw new ApiError(400, 'User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profilePicture = getDefaultDiceBearAvatar(name);

    const employee = await prisma.$transaction(async (tx) => {
      const licenseReservation = await checkAndReserveLicense(organization.id, tx);
      if (!licenseReservation.allowed) {
        // Send notification to Org Admins asynchronously
        const { sendAdminNotification } = require('../services/notificationService');
        sendAdminNotification(
          organization.id,
          'LICENSE_LIMIT_REACHED',
          'License Limit Reached',
          'An employee attempted to register, but all available licenses for your organization have been used. Please add more licenses to allow new employee registrations.',
          { entityType: 'Organization', entityId: organization.id }
        ).catch((err) => console.error('Failed to send license limit admin notification:', err));

        throw new ApiError(400, 'All available licenses have been used. Please contact your administrator to add more licenses.');
      }

      return await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'Employee',
          organizationId: organization.id,
          isProfileComplete: false,
          profilePicture
        }
      });
    });

    // Auto-assign mandatory trainings & active auto-assignment rules
    await autoAssignMandatoryTrainings(employee.id, organization.id);
    await autoAssignRulesToNewEmployee(employee.id, organization.id);

    // Notify Org Admins
    const { sendAdminNotification } = require('../services/notificationService');
    await sendAdminNotification(
      organization.id,
      'NEW_EMPLOYEE_REGISTERED',
      'New Employee Registered',
      `A new employee, ${employee.name}, has registered in your organization.`,
      { entityType: 'User', entityId: employee.id }
    );

    generateTokenAndSetCookie(res, employee.id, employee.role, employee.organizationId, employee.name);

    const userObj = formatUserResponse(employee);

    res.status(201).json(
      new ApiResponse(
        201,
        { user: userObj, organization: withId(organization) },
        'Employee registered successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login User (Admin, Instructor, Employee)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Please provide email and password');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Fast flat query for User record without heavy 3-table relational joins
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        status: true,
        organizationId: true,
        departmentId: true,
        jobRole: true,
        isProfileComplete: true,
        profilePicture: true
      }
    });

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (user.status === 'deactivated') {
      throw new ApiError(403, 'Your account has been deactivated. Please contact your administrator.');
    }

    // Parallel fetch of organization and department details only after successful auth
    const orgPromise = user.organizationId
      ? prisma.organization.findUnique({
          where: { id: user.organizationId },
          select: { id: true, name: true, code: true, status: true }
        })
      : Promise.resolve(null);

    const deptPromise = user.departmentId
      ? prisma.department.findUnique({
          where: { id: user.departmentId },
          select: { id: true, name: true, jobRoles: true }
        })
      : Promise.resolve(null);

    const [organization, department] = await Promise.all([orgPromise, deptPromise]);

    if (user.role !== 'SuperAdmin' && organization && String(organization.status || 'ACTIVE').toUpperCase() === 'INACTIVE') {
      throw new ApiError(403, 'Your organization has been deactivated by the Super Admin. Please contact your administrator.');
    }

    const fullUser = {
      ...user,
      organization,
      department
    };

    generateTokenAndSetCookie(res, fullUser.id, fullUser.role, fullUser.organizationId, fullUser.name);

    const userObj = formatUserResponse(fullUser);

    res.status(200).json(
      new ApiResponse(
        200,
        { user: userObj },
        'Logged in successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout User / Clear Cookie
 * @route   POST /api/auth/logout
 * @access  Public / Private
 */
const logout = async (req, res, next) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('jwt', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      expires: new Date(0)
    });

    res.status(200).json(new ApiResponse(200, {}, 'Logged out successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Current User Profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  const startTime = performance.now();
  try {
    const userId = String(req.user.id || req.user._id);
    const isSuperAdmin = req.user.role === 'SuperAdmin';

    const selectFields = {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      organizationId: true,
      departmentId: true,
      jobRole: true,
      isProfileComplete: true,
      profilePicture: true,
      ...(isSuperAdmin ? {} : {
        organization: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, jobRoles: true } }
      })
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectFields
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const userObj = formatUserResponse(user);
    const totalTime = (performance.now() - startTime).toFixed(2);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PERF] GET /api/auth/me - Total: ${totalTime}ms`);
    }

    res.status(200).json(new ApiResponse(200, { user: userObj }, 'Current user profile retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Logged-in User Profile (Admin, Instructor, Employee)
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateMyProfile = async (req, res, next) => {
  try {
    const { name, departmentId, jobRole } = req.body;
    const userId = String(req.user.id || req.user._id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        isCustomAvatar: true,
        organizationId: true,
        departmentId: true,
        jobRole: true
      }
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const updateData = {};

    if (name) {
      if (!name.trim()) {
        throw new ApiError(400, 'Name cannot be empty');
      }
      updateData.name = name.trim();
      if (!user.isCustomAvatar) {
        updateData.profilePicture = getDefaultDiceBearAvatar(updateData.name);
      }
    }

    if (departmentId && user.role !== 'SuperAdmin') {
      const depId = String(departmentId);
      const dep = await prisma.department.findFirst({
        where: { id: depId, organizationId: user.organizationId }
      });
      if (!dep) {
        throw new ApiError(404, 'Selected department does not exist in your organization');
      }
      updateData.departmentId = depId;
    }

    if (jobRole && user.role !== 'SuperAdmin') {
      updateData.jobRole = jobRole.trim();
    }

    const effectiveDepId = updateData.departmentId || user.departmentId;
    const effectiveJobRole = updateData.jobRole || user.jobRole;

    if (user.role === 'Employee' && effectiveDepId && effectiveJobRole) {
      updateData.isProfileComplete = true;
    }

    const updatedUserRecord = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, jobRoles: true } }
      }
    });

    if (user.role === 'Employee' && updatedUserRecord.isProfileComplete) {
      autoAssignMandatoryTrainings(updatedUserRecord.id, updatedUserRecord.organizationId).catch(console.error);
      autoAssignDeptRoleTrainings(updatedUserRecord.id, updatedUserRecord.organizationId, updatedUserRecord.departmentId, updatedUserRecord.jobRole).catch(console.error);
      autoAssignRulesToNewEmployee(updatedUserRecord.id, updatedUserRecord.organizationId).catch(console.error);
    }

    logAuditAction(req.user, 'UPDATE_PROFILE', 'User', updatedUserRecord.id, `Profile updated for ${updatedUserRecord.role} ${updatedUserRecord.name}`).catch((err) => {
      console.error('Failed to log audit action for updateMyProfile:', err);
    });

    res.status(200).json(new ApiResponse(200, { user: formatUserResponse(updatedUserRecord) }, 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change Password (Admin, Instructor, Employee)
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new ApiError(400, 'Please provide both currentPassword and newPassword');
    }

    if (currentPassword === newPassword) {
      throw new ApiError(400, 'New password must be different from your current password.');
    }

    if (newPassword.length < 6) {
      throw new ApiError(400, 'New password must be at least 6 characters long');
    }

    const userId = String(req.user.id || req.user._id);

    // Parallelize CPU-intensive hashing while querying DB with selective projection
    const hashPromise = bcrypt.hash(newPassword, 10);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        name: true,
        role: true,
        organizationId: true
      }
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    const hashedPassword = await hashPromise;

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // Fire and forget audit log & notification non-blocking
    const { sendUserNotification } = require('../services/notificationService');
    Promise.all([
      logAuditAction(req.user, 'CHANGE_PASSWORD', 'User', user.id, `Password changed for user ${user.name}`),
      sendUserNotification(
        user.id,
        user.organizationId,
        user.role,
        'PASSWORD_CHANGED',
        'Password Changed',
        'Your account password was changed successfully.',
        { entityType: 'User', entityId: user.id }
      )
    ]).catch((err) => {
      console.error('Failed to process post-password-change background tasks:', err);
    });

    res.status(200).json(new ApiResponse(200, {}, 'Password changed successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload / Update Profile Picture (Admin, Instructor, Employee)
 * @route   PUT /api/auth/profile-picture
 * @access  Private
 */
const updateProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please select an image file to upload as profile picture');
    }

    const userId = String(req.user.id || req.user._id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, profilePicturePublicId: true }
    });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const cloudinaryInstance = getCloudinary();

    if (user.profilePicturePublicId) {
      cloudinaryInstance.uploader.destroy(user.profilePicturePublicId).catch((err) => {
        console.error('Failed to destroy previous profile picture from Cloudinary:', err);
      });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinaryInstance.uploader.upload_stream(
        {
          folder: 'org_lms/profile_pictures',
          resource_type: 'image'
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const updatedUserRecord = await prisma.user.update({
      where: { id: user.id },
      data: {
        profilePicture: uploadResult.secure_url,
        profilePicturePublicId: uploadResult.public_id,
        isCustomAvatar: true
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, jobRoles: true } }
      }
    });

    logAuditAction(req.user, 'UPDATE_PROFILE_PICTURE', 'User', user.id, `Updated profile picture for ${user.role} ${user.name}`).catch((err) => {
      console.error('Failed to log audit action for updateProfilePicture:', err);
    });

    res.status(200).json(new ApiResponse(200, { user: formatUserResponse(updatedUserRecord) }, 'Profile picture updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset Profile Picture to Default DiceBear Avatar
 * @route   DELETE /api/auth/profile-picture
 * @access  Private
 */
const resetProfilePicture = async (req, res, next) => {
  try {
    const userId = String(req.user.id || req.user._id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, profilePicturePublicId: true }
    });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.profilePicturePublicId) {
      const cloudinaryInstance = getCloudinary();
      cloudinaryInstance.uploader.destroy(user.profilePicturePublicId).catch((err) => {
        console.error('Failed to destroy Cloudinary image:', err);
      });
    }

    const updatedUserRecord = await prisma.user.update({
      where: { id: user.id },
      data: {
        profilePicturePublicId: null,
        isCustomAvatar: false,
        profilePicture: getDefaultDiceBearAvatar(user.name)
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, jobRoles: true } }
      }
    });

    logAuditAction(req.user, 'RESET_PROFILE_PICTURE', 'User', user.id, `Reset profile picture to default for ${user.name}`).catch((err) => {
      console.error('Failed to log audit action for resetProfilePicture:', err);
    });

    res.status(200).json(new ApiResponse(200, { user: formatUserResponse(updatedUserRecord) }, 'Profile picture reset to default avatar successfully'));
  } catch (error) {
    next(error);
  }
};

const crypto = require('crypto');
const { sendPasswordResetOTPEmail } = require('../services/emailService');

/**
 * @desc    Request Password Reset OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const requestPasswordResetOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      throw new ApiError(400, 'Please provide a valid email address');
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        passwordResetOtpExpiresAt: true
      }
    });

    if (user && user.status === 'active') {
      // Rate limit check: 1 request per 60 seconds
      if (user.passwordResetOtpExpiresAt) {
        const lastRequestedTime = new Date(user.passwordResetOtpExpiresAt).getTime() - 5 * 60 * 1000;
        if (Date.now() - lastRequestedTime < 60 * 1000) {
          throw new ApiError(429, 'An OTP was recently requested. Please wait 60 seconds before trying again.');
        }
      }

      const rawOtp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(rawOtp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store OTP directly on User record (invalidates previous OTP)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetOtpHash: otpHash,
          passwordResetOtpExpiresAt: expiresAt,
          passwordResetOtpUsed: false
        }
      });

      // Send email via email service
      sendPasswordResetOTPEmail(cleanEmail, rawOtp, user.name).catch((err) => {
        console.error('Failed to send OTP email asynchronously:', err);
      });
    }

    // Always return neutral response to prevent email enumeration
    res.status(200).json(
      new ApiResponse(
        200,
        {},
        'If an account with that email exists, a 6-digit OTP has been sent to your email address.'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Password Reset OTP
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
const verifyPasswordResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      throw new ApiError(400, 'Please provide both email and 6-digit OTP');
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    if (cleanOtp.length !== 6) {
      throw new ApiError(400, 'OTP must be a 6-digit number');
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        passwordResetOtpHash: true,
        passwordResetOtpExpiresAt: true,
        passwordResetOtpUsed: true
      }
    });

    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt ||
      user.passwordResetOtpUsed ||
      new Date(user.passwordResetOtpExpiresAt) <= new Date()
    ) {
      throw new ApiError(400, 'Invalid or expired OTP. Please request a new verification code.');
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.passwordResetOtpHash);
    if (!isMatch) {
      throw new ApiError(400, 'Incorrect OTP. Please check the code and try again.');
    }

    res.status(200).json(new ApiResponse(200, { valid: true }, 'OTP verified successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset Password using OTP
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      throw new ApiError(400, 'Please provide email, OTP, and new password');
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    if (newPassword.length < 6) {
      throw new ApiError(400, 'New password must be at least 6 characters long');
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        passwordResetOtpHash: true,
        passwordResetOtpExpiresAt: true,
        passwordResetOtpUsed: true
      }
    });

    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt ||
      user.passwordResetOtpUsed ||
      new Date(user.passwordResetOtpExpiresAt) <= new Date()
    ) {
      throw new ApiError(400, 'Invalid or expired OTP. Please request a new code.');
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.passwordResetOtpHash);
    if (!isMatch) {
      throw new ApiError(400, 'Incorrect OTP. Please check the code and try again.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and clear OTP fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpUsed: true
      }
    });

    // Log audit & send notification in background
    const { sendUserNotification } = require('../services/notificationService');
    Promise.all([
      logAuditAction(
        { id: user.id, name: user.name, role: user.role, organizationId: user.organizationId },
        'RESET_PASSWORD',
        'User',
        user.id,
        `Password reset completed via OTP for ${user.email}`
      ),
      sendUserNotification(
        user.id,
        user.organizationId,
        user.role,
        'PASSWORD_RESET',
        'Password Reset Successful',
        'Your account password was successfully reset using OTP verification.',
        { entityType: 'User', entityId: user.id }
      )
    ]).catch((err) => console.error('Background log error in resetPasswordWithOTP:', err));

    res.status(200).json(new ApiResponse(200, {}, 'Password reset successfully. You can now log in with your new password.'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  setupOrganization,
  registerEmployee,
  login,
  logout,
  getMe,
  updateMyProfile,
  changePassword,
  updateProfilePicture,
  resetProfilePicture,
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPasswordWithOTP
};
