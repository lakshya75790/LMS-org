const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');

/**
 * Automatically assign mandatory trainings to a newly registered/configured employee
 */
const autoAssignMandatoryTrainings = async (employeeId, organizationId) => {
  try {
    const empId = String(employeeId);
    const orgId = String(organizationId);

    const mandatoryTrainings = await prisma.training.findMany({
      where: {
        organizationId: orgId,
        isMandatory: true,
        isPublished: true,
        status: 'published'
      }
    });

    const now = new Date();
    const assignmentsCreated = [];

    for (const training of mandatoryTrainings) {
      const existing = await prisma.trainingAssignment.findUnique({
        where: { employeeId_trainingId: { employeeId: empId, trainingId: training.id } }
      });
      if (existing) {
        assignmentsCreated.push(withId(existing));
        continue;
      }

      const deadline = new Date(now.getTime() + (training.durationDays || 30) * 24 * 60 * 60 * 1000);

      try {
        const assignment = await prisma.trainingAssignment.create({
          data: {
            employeeId: empId,
            trainingId: training.id,
            assignedBy: null,
            organizationId: orgId,
            assignmentType: 'mandatory',
            assignedDate: now,
            deadline,
            status: 'Assigned'
          }
        });
        assignmentsCreated.push(withId(assignment));

        const { sendUserNotification } = require('./notificationService');
        await sendUserNotification(
          empId,
          orgId,
          'Employee',
          'NEW_TRAINING_ASSIGNED',
          'New Training Assigned',
          `You have been assigned new training '${training.title}'. Deadline: ${deadline.toDateString()}`,
          { entityType: 'TrainingAssignment', entityId: assignment.id },
          { preventDuplicates: true }
        );
      } catch (err) {
        if (err.code !== 'P2002' && err.code !== 11000) throw err;
      }
    }

    return assignmentsCreated;
  } catch (error) {
    console.error('Error auto-assigning mandatory trainings:', error);
    return [];
  }
};

/**
 * Automatically assign Department + Role matched trainings to an employee upon profile completion
 */
const autoAssignDeptRoleTrainings = async (employeeId, organizationId, departmentId, jobRole) => {
  try {
    if (!departmentId) return [];

    const empId = String(employeeId);
    const orgId = String(organizationId);
    const depId = String(departmentId);

    const matchedTrainings = await prisma.training.findMany({
      where: {
        organizationId: orgId,
        departmentId: depId,
        isPublished: true,
        status: 'published'
      }
    });

    const now = new Date();
    const assignmentsCreated = [];

    for (const training of matchedTrainings) {
      const existing = await prisma.trainingAssignment.findUnique({
        where: { employeeId_trainingId: { employeeId: empId, trainingId: training.id } }
      });
      if (existing) {
        assignmentsCreated.push(withId(existing));
        continue;
      }

      const deadline = new Date(now.getTime() + (training.durationDays || 30) * 24 * 60 * 60 * 1000);

      try {
        const assignment = await prisma.trainingAssignment.create({
          data: {
            employeeId: empId,
            trainingId: training.id,
            assignedBy: null,
            organizationId: orgId,
            assignmentType: 'dept_role',
            assignedDate: now,
            deadline,
            status: 'Assigned'
          }
        });
        assignmentsCreated.push(withId(assignment));

        const { sendUserNotification } = require('./notificationService');
        await sendUserNotification(
          empId,
          orgId,
          'Employee',
          'NEW_TRAINING_ASSIGNED',
          'New Training Assigned',
          `You have been assigned new training '${training.title}'. Deadline: ${deadline.toDateString()}`,
          { entityType: 'TrainingAssignment', entityId: assignment.id },
          { preventDuplicates: true }
        );
      } catch (err) {
        if (err.code !== 'P2002' && err.code !== 11000) throw err;
      }
    }

    return assignmentsCreated;
  } catch (error) {
    console.error('Error auto-assigning dept/role trainings:', error);
    return [];
  }
};

/**
 * Automatically assign active Organization Auto-Assignment Rules to a new/updating employee
 */
const autoAssignRulesToNewEmployee = async (employeeId, organizationId) => {
  try {
    const empId = String(employeeId);
    const orgId = String(organizationId);

    const activeRules = await prisma.autoAssignmentRule.findMany({
      where: {
        organizationId: orgId,
        status: 'active',
        training: {
          isPublished: true,
          status: 'published'
        }
      },
      include: {
        training: { select: { id: true, title: true } }
      }
    });

    const now = new Date();
    const assignmentsCreated = [];

    for (const rule of activeRules) {
      const existing = await prisma.trainingAssignment.findUnique({
        where: { employeeId_trainingId: { employeeId: empId, trainingId: rule.trainingId } }
      });
      if (existing) {
        assignmentsCreated.push(withId(existing));
        continue;
      }

      const deadlineDays = rule.customDeadlineDays || 30;
      const deadline = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

      try {
        const assignment = await prisma.trainingAssignment.create({
          data: {
            employeeId: empId,
            trainingId: rule.trainingId,
            assignedBy: rule.createdBy,
            organizationId: orgId,
            assignmentType: 'auto',
            assignedDate: now,
            deadline,
            status: 'Assigned'
          }
        });
        assignmentsCreated.push(withId(assignment));

        const { sendUserNotification } = require('./notificationService');
        const trainingTitle = rule.training?.title || 'Course';
        await sendUserNotification(
          empId,
          orgId,
          'Employee',
          'NEW_TRAINING_ASSIGNED',
          'New Training Assigned',
          `You have been assigned new training '${trainingTitle}'. Deadline: ${deadline.toDateString()}`,
          { entityType: 'TrainingAssignment', entityId: assignment.id },
          { preventDuplicates: true }
        );
      } catch (err) {
        if (err.code !== 'P2002' && err.code !== 11000) throw err;
      }
    }

    return assignmentsCreated;
  } catch (error) {
    console.error('Error applying auto-assignment rules to employee:', error);
    return [];
  }
};

/**
 * Admin creates an Auto Assignment Rule (compulsory for ALL existing & future employees)
 */
const createAutoAssignmentRule = async (adminId, organizationId, trainingId, customDeadlineDays = 30) => {
  const admId = String(adminId);
  const orgId = String(organizationId);
  const trgId = String(trainingId);

  const training = await prisma.training.findFirst({
    where: {
      id: trgId,
      organizationId: orgId,
      isPublished: true,
      status: 'published'
    }
  });

  if (!training) {
    throw new Error('Published training course not found in your organization');
  }

  // Check if rule exists
  let rule = await prisma.autoAssignmentRule.findFirst({
    where: { organizationId: orgId, trainingId: trgId }
  });

  if (rule && rule.status === 'active') {
    throw new Error('An active auto-assignment rule already exists for this training');
  }

  if (rule) {
    rule = await prisma.autoAssignmentRule.update({
      where: { id: rule.id },
      data: {
        status: 'active',
        createdBy: admId,
        customDeadlineDays: Number(customDeadlineDays) || 30
      }
    });
  } else {
    rule = await prisma.autoAssignmentRule.create({
      data: {
        organizationId: orgId,
        trainingId: trgId,
        createdBy: admId,
        status: 'active',
        customDeadlineDays: Number(customDeadlineDays) || 30
      }
    });
  }

  // Immediately assign training to ALL existing active employees in the organization
  const employees = await prisma.user.findMany({
    where: { organizationId: orgId, role: 'Employee' }
  });
  const now = new Date();
  const deadlineDays = Number(customDeadlineDays) || 30;
  const deadline = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

  let assignedCount = 0;
  for (const emp of employees) {
    const existing = await prisma.trainingAssignment.findUnique({
      where: { employeeId_trainingId: { employeeId: emp.id, trainingId: training.id } }
    });
    if (existing) continue;

    try {
      const assignment = await prisma.trainingAssignment.create({
        data: {
          employeeId: emp.id,
          trainingId: training.id,
          assignedBy: admId,
          organizationId: orgId,
          assignmentType: 'auto',
          assignedDate: now,
          deadline,
          status: 'Assigned'
        }
      });
      assignedCount++;

      const { sendUserNotification } = require('./notificationService');
      await sendUserNotification(
        emp.id,
        orgId,
        'Employee',
        'NEW_TRAINING_ASSIGNED',
        'New Training Assigned',
        `You have been assigned new training '${training.title}'. Deadline: ${deadline.toDateString()}`,
        { entityType: 'TrainingAssignment', entityId: assignment.id },
        { preventDuplicates: true }
      );
    } catch (err) {
      if (err.code !== 'P2002' && err.code !== 11000) throw err;
    }
  }

  return { rule: withId(rule), assignedCount, totalEmployees: employees.length };
};

/**
 * Deactivate an Auto Assignment Rule
 */
const deactivateAutoAssignmentRule = async (adminId, organizationId, ruleId) => {
  const orgId = String(organizationId);
  const rId = String(ruleId);

  const rule = await prisma.autoAssignmentRule.findFirst({
    where: { id: rId, organizationId: orgId }
  });
  if (!rule) {
    throw new ApiError(404, 'Auto assignment rule not found');
  }

  const updatedRule = await prisma.autoAssignmentRule.update({
    where: { id: rule.id },
    data: { status: 'inactive' }
  });

  return withId(updatedRule);
};

/**
 * Reactivate an Auto Assignment Rule
 */
const reactivateAutoAssignmentRule = async (adminId, organizationId, ruleId) => {
  const admId = String(adminId);
  const orgId = String(organizationId);
  const rId = String(ruleId);

  const rule = await prisma.autoAssignmentRule.findFirst({
    where: { id: rId, organizationId: orgId },
    include: {
      training: { select: { id: true, title: true, isPublished: true, status: true } }
    }
  });
  if (!rule) {
    throw new ApiError(404, 'Auto assignment rule not found');
  }
  if (!rule.training || !rule.training.isPublished || rule.training.status !== 'published') {
    throw new ApiError(400, 'Cannot reactivate auto-assignment rule for an archived or unpublished training');
  }

  const updatedRule = await prisma.autoAssignmentRule.update({
    where: { id: rule.id },
    data: {
      status: 'active'
    }
  });

  const employees = await prisma.user.findMany({
    where: { organizationId: orgId, role: 'Employee' }
  });
  const now = new Date();
  const deadlineDays = Number(rule.customDeadlineDays) || 30;
  const deadline = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

  let newAssignmentsCount = 0;
  for (const emp of employees) {
    const existing = await prisma.trainingAssignment.findUnique({
      where: { employeeId_trainingId: { employeeId: emp.id, trainingId: rule.trainingId } }
    });
    if (existing) continue;

    try {
      const assignment = await prisma.trainingAssignment.create({
        data: {
          employeeId: emp.id,
          trainingId: rule.trainingId,
          assignedBy: admId,
          organizationId: orgId,
          assignmentType: 'auto',
          assignedDate: now,
          deadline,
          status: 'Assigned'
        }
      });
      newAssignmentsCount++;

      const { sendUserNotification } = require('./notificationService');
      const trainingTitle = rule.training?.title || 'Course';
      await sendUserNotification(
        emp.id,
        orgId,
        'Employee',
        'NEW_TRAINING_ASSIGNED',
        'New Training Assigned',
        `You have been assigned new training '${trainingTitle}'. Deadline: ${deadline.toDateString()}`,
        { entityType: 'TrainingAssignment', entityId: assignment.id },
        { preventDuplicates: true }
      );
    } catch (err) {
      if (err.code !== 'P2002' && err.code !== 11000) throw err;
    }
  }

  return { rule: withId(updatedRule), newAssignmentsCount };
};

/**
 * Get all Auto Assignment Rules for organization
 */
const getAutoAssignmentRules = async (organizationId) => {
  const orgId = String(organizationId);

  const rules = await prisma.autoAssignmentRule.findMany({
    where: {
      organizationId: orgId,
      training: {
        isPublished: true,
        status: 'published'
      }
    },
    include: {
      training: {
        select: {
          id: true,
          title: true,
          status: true,
          category: { select: { id: true, name: true } }
        }
      },
      creator: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (rules.length === 0) {
    return [];
  }

  const targetTrainingIds = Array.from(new Set(rules.map(r => r.trainingId)));

  const coverageCounts = await prisma.trainingAssignment.groupBy({
    by: ['trainingId'],
    where: { organizationId: orgId, trainingId: { in: targetTrainingIds } },
    _count: { trainingId: true }
  });

  const countMap = new Map(coverageCounts.map(c => [c.trainingId, c._count.trainingId]));

  const rulesWithStats = rules.map((r) => {
    const coverageCount = countMap.get(r.trainingId) || 0;

    const transformed = withId(r);
    if (transformed.training) {
      transformed.trainingId = transformed.training;
      if (transformed.training.category) {
        transformed.trainingId.categoryId = transformed.training.category;
      }
    }
    if (transformed.creator) {
      transformed.createdBy = transformed.creator;
    }

    return {
      ...transformed,
      coverageCount
    };
  });

  return rulesWithStats;
};

/**
 * Admin assigns training to all employees matching Department + Job Role
 */
const assignTrainingByDeptAndRole = async (adminId, organizationId, departmentId, jobRole, trainingId, customDeadlineDate = null) => {
  const admId = String(adminId);
  const orgId = String(organizationId);
  const depId = String(departmentId);
  const trgId = String(trainingId);

  const training = await prisma.training.findFirst({
    where: {
      id: trgId,
      organizationId: orgId,
      isPublished: true,
      status: 'published'
    }
  });

  if (!training) {
    throw new Error('Published training course not found in your organization');
  }

  const whereClause = { organizationId: orgId, role: 'Employee', departmentId: depId };
  if (jobRole && jobRole !== 'ALL_ROLES') {
    whereClause.jobRole = jobRole;
  }

  const employees = await prisma.user.findMany({ where: whereClause });

  if (employees.length === 0) {
    throw new Error('No employees match the specified Department and Job Role');
  }

  const now = new Date();
  let deadline;
  if (customDeadlineDate) {
    deadline = new Date(customDeadlineDate);
  } else {
    deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  const results = [];
  let newAssignmentsCount = 0;

  for (const emp of employees) {
    const existing = await prisma.trainingAssignment.findUnique({
      where: { employeeId_trainingId: { employeeId: emp.id, trainingId: training.id } }
    });
    if (existing) {
      results.push(withId(existing));
      continue;
    }

    try {
      const assignment = await prisma.trainingAssignment.create({
        data: {
          employeeId: emp.id,
          trainingId: training.id,
          assignedBy: admId,
          organizationId: orgId,
          assignmentType: 'dept_role',
          assignedDate: now,
          deadline,
          status: 'Assigned'
        }
      });
      results.push(withId(assignment));
      newAssignmentsCount++;

      const { sendUserNotification, sendInstructorNotification } = require('./notificationService');
      const relEntity = { entityType: 'TrainingAssignment', entityId: assignment.id };
      await sendUserNotification(
        emp.id,
        orgId,
        'Employee',
        'NEW_TRAINING_ASSIGNED',
        'New Training Assigned',
        `You have been assigned new training '${training.title}'. Deadline: ${deadline.toDateString()}`,
        relEntity
      );
      if (training.createdBy) {
        await sendInstructorNotification(
          training.createdBy,
          orgId,
          'TRAINING_ASSIGNED',
          'Training Assigned to Employee',
          `Training '${training.title}' was assigned to employee ${emp.name}.`,
          relEntity
        );
      }
    } catch (err) {
      if (err.code !== 'P2002' && err.code !== 11000) throw err;
    }
  }

  if (newAssignmentsCount > 0) {
    const { sendAdminNotification } = require('./notificationService');
    await sendAdminNotification(
      orgId,
      'TRAINING_ASSIGNED',
      'Training Assigned',
      `Training '${training.title}' was assigned to ${newAssignmentsCount} employee(s).`,
      { entityType: 'Training', entityId: training.id }
    );
  }

  return { results, newAssignmentsCount, matchedEmployeesCount: employees.length };
};

/**
 * Admin assigns training to multiple specific employees
 */
const assignTrainingToMultipleEmployees = async (adminId, organizationId, employeeIds, trainingId, customDeadlineDate = null) => {
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    throw new Error('At least one employee must be selected');
  }

  const admId = String(adminId);
  const orgId = String(organizationId);
  const trgId = String(trainingId);
  const empIds = employeeIds.map(id => String(id));

  const training = await prisma.training.findFirst({
    where: {
      id: trgId,
      organizationId: orgId,
      isPublished: true,
      status: 'published'
    }
  });

  if (!training) {
    throw new Error('Published training course not found in your organization');
  }

  const employees = await prisma.user.findMany({
    where: {
      id: { in: empIds },
      organizationId: orgId,
      role: 'Employee'
    }
  });

  if (employees.length === 0) {
    throw new Error('No valid employees found from selected list');
  }

  const now = new Date();
  let deadline;
  if (customDeadlineDate) {
    deadline = new Date(customDeadlineDate);
  } else {
    deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  const results = [];
  let newAssignmentsCount = 0;

  for (const emp of employees) {
    const existing = await prisma.trainingAssignment.findUnique({
      where: { employeeId_trainingId: { employeeId: emp.id, trainingId: training.id } }
    });
    if (existing) {
      results.push(withId(existing));
      continue;
    }

    try {
      const assignment = await prisma.trainingAssignment.create({
        data: {
          employeeId: emp.id,
          trainingId: training.id,
          assignedBy: admId,
          organizationId: orgId,
          assignmentType: 'specific',
          assignedDate: now,
          deadline,
          status: 'Assigned'
        }
      });
      results.push(withId(assignment));
      newAssignmentsCount++;

      const { sendUserNotification, sendInstructorNotification } = require('./notificationService');
      const relEntity = { entityType: 'TrainingAssignment', entityId: assignment.id };
      await sendUserNotification(
        emp.id,
        orgId,
        'Employee',
        'NEW_TRAINING_ASSIGNED',
        'New Training Assigned',
        `You have been assigned new training '${training.title}'. Deadline: ${deadline.toDateString()}`,
        relEntity
      );
      if (training.createdBy) {
        await sendInstructorNotification(
          training.createdBy,
          orgId,
          'TRAINING_ASSIGNED',
          'Training Assigned to Employee',
          `Training '${training.title}' was assigned to employee ${emp.name}.`,
          relEntity
        );
      }
    } catch (err) {
      if (err.code !== 'P2002' && err.code !== 11000) throw err;
    }
  }

  if (newAssignmentsCount > 0) {
    const { sendAdminNotification } = require('./notificationService');
    await sendAdminNotification(
      orgId,
      'TRAINING_ASSIGNED',
      'Training Assigned',
      `Training '${training.title}' was assigned to ${newAssignmentsCount} employee(s).`,
      { entityType: 'Training', entityId: training.id }
    );
  }

  return { results, newAssignmentsCount, selectedEmployeesCount: employees.length };
};

module.exports = {
  autoAssignMandatoryTrainings,
  autoAssignDeptRoleTrainings,
  autoAssignRulesToNewEmployee,
  createAutoAssignmentRule,
  deactivateAutoAssignmentRule,
  reactivateAutoAssignmentRule,
  getAutoAssignmentRules,
  assignTrainingByDeptAndRole,
  assignTrainingToMultipleEmployees
};
