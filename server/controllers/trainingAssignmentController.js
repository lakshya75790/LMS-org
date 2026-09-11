const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const {
  createAutoAssignmentRule,
  deactivateAutoAssignmentRule,
  reactivateAutoAssignmentRule,
  getAutoAssignmentRules,
  assignTrainingByDeptAndRole,
  assignTrainingToMultipleEmployees
} = require('../services/trainingAssignmentService');
const { sendUserNotification, sendAdminNotification } = require('../services/notificationService');
const { logAuditAction } = require('../services/auditLogService');
const { updateOverallProgress } = require('../services/progressService');

/**
 * Helper to get populated training assignment matching backward compatible Mongoose format
 */
const getPopulatedAssignment = async (assignmentId) => {
  const aId = String(assignmentId);
  const assignment = await prisma.trainingAssignment.findUnique({
    where: { id: aId },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          departmentId: true,
          jobRole: true,
          profilePicture: true,
          status: true
        }
      },
      training: {
        select: {
          id: true,
          title: true,
          description: true,
          categoryId: true,
          departmentId: true,
          createdBy: true,
          durationDays: true,
          thumbnailUrl: true,
          isPublished: true,
          status: true,
          category: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          instructor: { select: { id: true, name: true, email: true } },
          sections: {
            orderBy: { order: 'asc' },
            include: {
              subSections: {
                orderBy: { order: 'asc' },
                include: {
                  pdfResources: true,
                  assignment: true
                }
              }
            }
          },
          quizzes: {
            include: { questions: true }
          },
          assignments: true
        }
      },
      assigner: { select: { id: true, name: true, email: true, role: true } },
      extensionHistory: {
        orderBy: { extendedAt: 'desc' },
        include: {
          extendedByUser: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });

  if (!assignment) return null;

  const transformed = withId(assignment);
  if (transformed.employee) transformed.employeeId = transformed.employee;
  if (transformed.training) {
    transformed.trainingId = transformed.training;
    if (transformed.training.category) transformed.trainingId.categoryId = transformed.training.category;
    if (transformed.training.department) transformed.trainingId.departmentId = transformed.training.department;
    if (transformed.training.instructor) transformed.trainingId.createdBy = transformed.training.instructor;

    if (Array.isArray(transformed.trainingId.sections)) {
      transformed.trainingId.sections = transformed.trainingId.sections.map(sec => {
        const transformedSec = withId(sec);
        if (Array.isArray(transformedSec.subSections)) {
          transformedSec.subSections = transformedSec.subSections.map(sub => {
            const transformedSub = withId(sub);
            transformedSub.pdfResources = (sub.pdfResources || []).map(r => {
              const transformedPdf = withId(r);
              transformedPdf.fileUrl = r.pdfUrl || r.fileUrl || '';
              transformedPdf.filePublicId = r.pdfPublicId || r.filePublicId || '';
              return transformedPdf;
            });

            const matchingQuiz = assignment.training.quizzes?.find(q => q.subSectionId === sub.id);
            if (matchingQuiz || sub.hasQuiz || sub.quizId) {
              transformedSub.hasQuiz = true;
              transformedSub.quizId = matchingQuiz ? withId(matchingQuiz) : sub.quizId;
            } else {
              transformedSub.hasQuiz = false;
            }

            const matchingAssignment = assignment.training.assignments?.find(a => a.subSectionId === sub.id);
            if (matchingAssignment || sub.hasAssignment || sub.assignmentId || sub.assignment) {
              transformedSub.hasAssignment = true;
              transformedSub.assignmentId = matchingAssignment ? withId(matchingAssignment) : (sub.assignment ? withId(sub.assignment) : sub.assignmentId);
            } else {
              transformedSub.hasAssignment = false;
            }

            return transformedSub;
          });
        }
        return transformedSec;
      });
    }

    const mainAssignment = assignment.training.assignments?.find(a => !a.subSectionId);
    if (mainAssignment) {
      transformed.trainingId.assignmentId = withId(mainAssignment);
    }
  }
  if (transformed.assigner) transformed.assignedBy = transformed.assigner;

  transformed.lockStatus = {
    isLocked: transformed.isLocked,
    lockedAt: transformed.lockedAt,
    unlockedAt: transformed.unlockedAt,
    lockedReason: transformed.lockedReason
  };

  return transformed;
};

/**
 * @desc    Manually Assign Training (Admin only)
 * @route   POST /api/assignments-engine/assign
 * @access  Private (Organization Admin)
 */
const assignTraining = async (req, res, next) => {
  try {
    const { assignmentType, trainingId, departmentId, jobRole, employeeId, employeeIds, customDeadline } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);

    if (!trainingId || !assignmentType) {
      throw new ApiError(400, 'trainingId and assignmentType are required');
    }

    let result;

    if (assignmentType === 'dept_role') {
      if (!departmentId) {
        throw new ApiError(400, 'Department selection is required for targeted assignment');
      }
      result = await assignTrainingByDeptAndRole(
        userId,
        orgId,
        departmentId,
        jobRole || 'ALL_ROLES',
        trainingId,
        customDeadline
      );
    } else if (assignmentType === 'specific') {
      const ids = employeeIds || (employeeId ? [employeeId] : []);
      if (!ids || ids.length === 0) {
        throw new ApiError(400, 'At least one employee must be selected');
      }
      result = await assignTrainingToMultipleEmployees(
        userId,
        orgId,
        ids,
        trainingId,
        customDeadline
      );
    } else {
      throw new ApiError(400, 'Invalid assignmentType. Must be "dept_role" or "specific"');
    }

    logAuditAction(req.user, 'ASSIGN_TRAINING', 'Training', trainingId, `Assigned training via ${assignmentType}`).catch(err => console.error('Audit log error in assignTraining:', err));

    res.status(201).json(new ApiResponse(201, { result }, 'Training assigned successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create Auto Assignment Rule (Admin only)
 * @route   POST /api/assignments-engine/auto-rule
 * @access  Private (Organization Admin)
 */
const createAutoRule = async (req, res, next) => {
  try {
    const { trainingId, customDeadlineDays } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);

    if (!trainingId) {
      throw new ApiError(400, 'trainingId is required for auto-assignment');
    }

    const { rule, assignedCount, totalEmployees } = await createAutoAssignmentRule(
      userId,
      orgId,
      trainingId,
      customDeadlineDays || 30
    );

    logAuditAction(
      req.user,
      'CREATE_AUTO_ASSIGNMENT_RULE',
      'Training',
      trainingId,
      `Configured compulsory auto-assignment rule for ${assignedCount} of ${totalEmployees} employees`
    ).catch(err => console.error('Audit log error in createAutoRule:', err));

    res.status(201).json(
      new ApiResponse(
        201,
        { rule, assignedCount, totalEmployees },
        `Auto-assignment rule configured. Assigned to ${assignedCount} existing employees.`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate Auto Assignment Rule (Admin only)
 * @route   PUT /api/assignments-engine/auto-rules/:id/deactivate
 * @access  Private (Organization Admin)
 */
const deactivateAutoRule = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);

    const rule = await deactivateAutoAssignmentRule(
      userId,
      orgId,
      req.params.id
    );

    logAuditAction(
      req.user,
      'DEACTIVATE_AUTO_ASSIGNMENT_RULE',
      'AutoAssignmentRule',
      rule.id || rule._id,
      `Deactivated auto-assignment rule`
    ).catch(err => console.error('Audit log error in deactivateAutoRule:', err));

    res.status(200).json(
      new ApiResponse(200, { rule }, 'Auto-assignment rule deactivated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reactivate Auto Assignment Rule (Admin only)
 * @route   PUT /api/assignments-engine/auto-rules/:id/reactivate
 * @access  Private (Organization Admin)
 */
const reactivateAutoRule = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);

    const { rule, newAssignmentsCount } = await reactivateAutoAssignmentRule(
      userId,
      orgId,
      req.params.id
    );

    logAuditAction(
      req.user,
      'REACTIVATE_AUTO_ASSIGNMENT_RULE',
      'AutoAssignmentRule',
      rule.id || rule._id,
      `Reactivated auto-assignment rule`
    ).catch(err => console.error('Audit log error in reactivateAutoRule:', err));

    res.status(200).json(
      new ApiResponse(200, { rule, newAssignmentsCount }, 'Auto-assignment rule reactivated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Auto Assignment Rules (Admin only)
 * @route   GET /api/assignments-engine/auto-rules
 * @access  Private (Organization Admin)
 */
const getAutoRules = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const rules = await getAutoAssignmentRules(orgId);

    res.status(200).json(
      new ApiResponse(200, { rules }, 'Auto-assignment rules retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Current Employee's Assigned Trainings
 * @route   GET /api/assignments-engine/my-assignments
 * @access  Private (Employee)
 */
const getMyAssignments = async (req, res, next) => {
  try {
    const now = new Date();
    const userId = String(req.user.id || req.user._id);
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    const assignmentsList = await prisma.trainingAssignment.findMany({
      where: {
        employeeId: userId,
        organizationId: orgId
      },
      select: {
        id: true,
        employeeId: true,
        trainingId: true,
        assignedBy: true,
        organizationId: true,
        assignmentType: true,
        assignedDate: true,
        deadline: true,
        status: true,
        progressPercentage: true,
        completedDate: true,
        overdueCount: true,
        isLocked: true,
        lockedAt: true,
        unlockedAt: true,
        lockedReason: true,
        createdAt: true,
        updatedAt: true,
        training: {
          select: {
            id: true,
            title: true,
            description: true,
            durationDays: true,
            thumbnailUrl: true,
            isPublished: true,
            status: true,
            category: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            instructor: { select: { id: true, name: true, email: true } },
            sections: {
              select: {
                id: true,
                subSections: {
                  select: { id: true }
                }
              }
            }
          }
        }
      },
      orderBy: { assignedDate: 'desc' }
    });

    const overdueIdsToUpdate = [];
    const assignments = assignmentsList.map(a => {
      if (a.status !== 'Completed' && a.status !== 'Locked' && new Date(a.deadline) < now && a.status !== 'Overdue') {
        a.status = 'Overdue';
        overdueIdsToUpdate.push(a.id);
      }

      const transformed = withId(a);
      if (transformed.training) {
        transformed.trainingId = transformed.training;
        if (transformed.training.category) transformed.trainingId.categoryId = transformed.training.category;
        if (transformed.training.department) transformed.trainingId.departmentId = transformed.training.department;
        if (transformed.training.instructor) transformed.trainingId.createdBy = transformed.training.instructor;
      }
      return transformed;
    });

    if (overdueIdsToUpdate.length > 0) {
      prisma.trainingAssignment.updateMany({
        where: { id: { in: overdueIdsToUpdate } },
        data: { status: 'Overdue' }
      }).catch(err => console.error('Error updating overdue status:', err));
    }

    res.status(200).json(new ApiResponse(200, { assignments }, 'Employee assignments retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get All Assignments in Organization (Admin / Instructor view)
 * @route   GET /api/assignments-engine/all
 * @access  Private (Admin, Instructor)
 */
const getAllAssignments = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);

    const whereClause = { organizationId: orgId };

    if (req.user.role === 'Instructor') {
      const ownedTrainings = await prisma.training.findMany({
        where: {
          createdBy: userId,
          organizationId: orgId,
          status: { notIn: ['archived', 'deleted'] }
        },
        select: { id: true }
      });
      const trainingIds = ownedTrainings.map(t => t.id);
      whereClause.trainingId = { in: trainingIds };
    }

    const assignmentsList = await prisma.trainingAssignment.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, name: true, email: true, departmentId: true, jobRole: true, profilePicture: true } },
        training: { select: { id: true, title: true, description: true, durationDays: true, category: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } },
        assigner: { select: { id: true, name: true, email: true } }
      },
      orderBy: { assignedDate: 'desc' }
    });

    const assignments = assignmentsList.map(a => {
      const transformed = withId(a);
      if (transformed.employee) transformed.employeeId = transformed.employee;
      if (transformed.training) {
        transformed.trainingId = transformed.training;
        if (transformed.training.category) transformed.trainingId.categoryId = transformed.training.category;
      }
      if (transformed.assigner) transformed.assignedBy = transformed.assigner;
      return transformed;
    });

    res.status(200).json(new ApiResponse(200, { assignments }, 'All assignments retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Extend Training Deadline for Employee
 * @route   PUT /api/assignments-engine/:assignmentId/extend-deadline
 * @access  Private (Instructor owner, Admin)
 */
const extendDeadline = async (req, res, next) => {
  try {
    const { newDeadline, reason } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const aId = String(req.params.assignmentId);

    if (!newDeadline) {
      throw new ApiError(400, 'newDeadline date is required');
    }

    const assignment = await prisma.trainingAssignment.findFirst({
      where: { id: aId, organizationId: orgId },
      include: {
        training: true,
        employee: { select: { id: true, name: true, email: true } }
      }
    });

    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }

    if (req.user.role === 'Instructor' && assignment.training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized to extend deadline for this training');
    }

    if (assignment.status === 'Completed' || assignment.progressPercentage === 100) {
      throw new ApiError(400, 'Cannot extend deadline for a completed training assignment');
    }

    const extendedToDate = new Date(newDeadline);

    await prisma.extensionHistory.create({
      data: {
        trainingAssignmentId: assignment.id,
        extendedBy: userId,
        extendedTo: extendedToDate,
        extendedAt: new Date(),
        reason: reason || 'Instructor granted deadline extension'
      }
    });

    let newStatus = assignment.status;
    if (assignment.status === 'Overdue' || assignment.status === 'Locked') {
      newStatus = assignment.progressPercentage > 0 ? 'In Progress' : 'Assigned';
    }

    await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: {
        deadline: extendedToDate,
        status: newStatus
      }
    });

    // Send notifications to Employee & Instructor
    await sendUserNotification(
      assignment.employeeId,
      orgId,
      'Employee',
      'DEADLINE_EXTENDED',
      'Deadline Extended',
      `The deadline for ${assignment.training.title} has been extended.`,
      { entityType: 'TrainingAssignment', entityId: assignment.id }
    );
    if (assignment.training.createdBy && assignment.training.createdBy !== userId) {
      await sendUserNotification(
        assignment.training.createdBy,
        orgId,
        'Instructor',
        'DEADLINE_EXTENDED',
        'Deadline Extended',
        `Deadline extended for ${assignment.employee.name} on ${assignment.training.title}.`,
        { entityType: 'TrainingAssignment', entityId: assignment.id }
      );
    }

    await sendUserNotification(
      assignment.employee.id,
      orgId,
      'Employee',
      'DEADLINE_EXTENDED',
      'Training Deadline Extended',
      `Your deadline for ${assignment.training.title} has been extended to ${extendedToDate.toDateString()}`,
      { entityType: 'TrainingAssignment', entityId: assignment.id }
    );

    await logAuditAction(req.user, 'EXTEND_DEADLINE', 'TrainingAssignment', assignment.id, `Extended deadline for ${assignment.employee.name} to ${extendedToDate.toDateString()}`);

    const updatedAssignment = await getPopulatedAssignment(assignment.id);

    res.status(200).json(new ApiResponse(200, { assignment: updatedAssignment }, 'Training deadline extended successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Lock Training for Employee
 * @route   PUT /api/assignments-engine/:assignmentId/lock
 * @access  Private (Instructor owner, Admin)
 */
const lockTraining = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const aId = String(req.params.assignmentId);

    const assignment = await prisma.trainingAssignment.findFirst({
      where: { id: aId, organizationId: orgId },
      include: {
        training: true,
        employee: { select: { id: true, name: true, email: true } }
      }
    });

    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }

    if (req.user.role === 'Instructor' && assignment.training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized to lock this training');
    }

    if (assignment.status === 'Completed' || assignment.progressPercentage === 100) {
      throw new ApiError(400, 'Cannot lock a completed training assignment');
    }

    await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: {
        isLocked: true,
        lockedAt: new Date(),
        unlockedAt: null,
        lockedReason: reason || 'Locked by instructor',
        status: 'Locked'
      }
    });

    const instructorName = req.user.name || 'Instructor';

    await sendUserNotification(
      assignment.employee.id,
      orgId,
      'Employee',
      'TRAINING_LOCKED',
      'Training Account Locked',
      `Your access to '${assignment.training.title}' has been locked by instructor ${instructorName}.`,
      { entityType: 'TrainingAssignment', entityId: assignment.id }
    );

    await sendAdminNotification(
      orgId,
      'TRAINING_LOCKED',
      'Employee Training Locked',
      `Training '${assignment.training.title}' has been locked for employee '${assignment.employee.name}' by instructor '${instructorName}'.`,
      { entityType: 'TrainingAssignment', entityId: assignment.id }
    );

    await logAuditAction(req.user, 'LOCK_TRAINING', 'TrainingAssignment', assignment.id, `Locked training for employee ${assignment.employee.name}`);

    const updatedAssignment = await getPopulatedAssignment(assignment.id);

    res.status(200).json(new ApiResponse(200, { assignment: updatedAssignment }, 'Training locked successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unlock Training for Employee
 * @route   PUT /api/assignments-engine/:assignmentId/unlock
 * @access  Private (Instructor owner, Admin)
 */
const unlockTraining = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const aId = String(req.params.assignmentId);

    const assignment = await prisma.trainingAssignment.findFirst({
      where: { id: aId, organizationId: orgId },
      include: {
        training: true,
        employee: { select: { id: true, name: true, email: true } }
      }
    });

    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }

    if (req.user.role === 'Instructor' && assignment.training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized to unlock this training');
    }

    if (assignment.status === 'Completed' || assignment.progressPercentage === 100) {
      throw new ApiError(400, 'Cannot unlock a completed training assignment');
    }

    const now = new Date();
    let newStatus = 'Assigned';
    if (new Date(assignment.deadline) < now) {
      newStatus = 'Overdue';
    } else if (assignment.progressPercentage > 0) {
      newStatus = 'In Progress';
    }

    await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: {
        isLocked: false,
        unlockedAt: now,
        status: newStatus
      }
    });

    const instructorName = req.user.name || 'Instructor';

    await sendUserNotification(
      assignment.employee.id,
      orgId,
      'Employee',
      'TRAINING_UNLOCKED',
      'Training Unlocked',
      `Your access to '${assignment.training.title}' has been unlocked by instructor ${instructorName}. You may resume learning.`,
      { entityType: 'TrainingAssignment', entityId: assignment.id }
    );

    await sendAdminNotification(
      orgId,
      'TRAINING_UNLOCKED',
      'Employee Training Unlocked',
      `Training '${assignment.training.title}' has been unlocked for employee '${assignment.employee.name}' by instructor '${instructorName}'.`,
      { entityType: 'TrainingAssignment', entityId: assignment.id }
    );

    await logAuditAction(req.user, 'UNLOCK_TRAINING', 'TrainingAssignment', assignment.id, `Unlocked training for employee ${assignment.employee.name}`);

    const updatedAssignment = await getPopulatedAssignment(assignment.id);

    res.status(200).json(new ApiResponse(200, { assignment: updatedAssignment }, 'Training unlocked successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  assignTraining,
  createAutoRule,
  deactivateAutoRule,
  reactivateAutoRule,
  getAutoRules,
  getMyAssignments,
  getAllAssignments,
  extendDeadline,
  lockTraining,
  unlockTraining
};
