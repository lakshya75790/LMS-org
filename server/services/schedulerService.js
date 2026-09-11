const { prisma } = require('../config/prismaClient');
const { sendUserNotification, sendInstructorNotification, sendAdminNotification } = require('./notificationService');

/**
 * Check deadlines and trigger idempotent notifications for upcoming and overdue trainings
 */
const checkTrainingDeadlines = async () => {
  try {
    const now = new Date();

    // Fetch all active, incomplete training assignments with employee & training details
    const assignments = await prisma.trainingAssignment.findMany({
      where: {
        status: { notIn: ['Completed'] },
        isLocked: false
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, status: true }
        },
        training: {
          select: { id: true, title: true, createdBy: true }
        }
      }
    });

    for (const assignment of assignments) {
      if (!assignment.employee || assignment.employee.status !== 'active') continue;
      if (!assignment.training) continue;

      const deadline = new Date(assignment.deadline);
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isOverdue = diffMs < 0;

      const empId = assignment.employeeId;
      const orgId = assignment.organizationId;
      const trgTitle = assignment.training.title;
      const empName = assignment.employee.name;
      const instructorId = assignment.training.createdBy;

      const relEntity = { entityType: 'TrainingAssignment', entityId: assignment.id };

      // Overdue check
      if (isOverdue) {
        // Update status to Overdue if not set
        if (assignment.status !== 'Overdue') {
          await prisma.trainingAssignment.update({
            where: { id: assignment.id },
            data: { status: 'Overdue' }
          }).catch(err => console.error('Error setting status to Overdue:', err));
        }

        // 1. Employee Overdue Notification
        await sendUserNotification(
          empId,
          orgId,
          'Employee',
          'TRAINING_OVERDUE',
          'Training Overdue',
          `Training '${trgTitle}' is now overdue. Please complete it as soon as possible.`,
          relEntity,
          { preventDuplicates: true }
        );

        // 2. Instructor Overdue Notification
        if (instructorId) {
          await sendInstructorNotification(
            instructorId,
            orgId,
            'EMPLOYEE_TRAINING_OVERDUE',
            'Employee Training Overdue',
            `Employee ${empName}'s training '${trgTitle}' is overdue.`,
            relEntity,
            { preventDuplicates: true }
          );
        }

        // 3. Admin Overdue Notification
        await sendAdminNotification(
          orgId,
          'EMPLOYEE_TRAINING_OVERDUE',
          'Employee Training Overdue',
          `Employee ${empName}'s training '${trgTitle}' is overdue.`,
          relEntity,
          { preventDuplicates: true }
        );
      } else {
        // Milestone notifications (7d, 3d, 2d, 1d, 0d)
        if (diffDays === 7) {
          await sendUserNotification(
            empId,
            orgId,
            'Employee',
            'DEADLINE_APPROACHING_7_DAYS',
            '7 Days Remaining',
            `Deadline in 7 days for '${trgTitle}'.`,
            relEntity,
            { preventDuplicates: true }
          );
          if (instructorId) {
            await sendInstructorNotification(
              instructorId,
              orgId,
              'TRAINING_DEADLINE_APPROACHING',
              'Training Deadline Approaching',
              `Deadline in 7 days for ${empName} on '${trgTitle}'.`,
              relEntity,
              { preventDuplicates: true }
            );
          }
        } else if (diffDays === 3) {
          await sendUserNotification(
            empId,
            orgId,
            'Employee',
            'DEADLINE_APPROACHING_3_DAYS',
            '3 Days Remaining',
            `Deadline in 3 days for '${trgTitle}'.`,
            relEntity,
            { preventDuplicates: true }
          );
          if (instructorId) {
            await sendInstructorNotification(
              instructorId,
              orgId,
              'TRAINING_DEADLINE_APPROACHING',
              'Training Deadline Approaching',
              `Deadline in 3 days for ${empName} on '${trgTitle}'.`,
              relEntity,
              { preventDuplicates: true }
            );
          }
        } else if (diffDays === 2) {
          await sendUserNotification(
            empId,
            orgId,
            'Employee',
            'DEADLINE_APPROACHING_2_DAYS',
            '2 Days Remaining',
            `Deadline in 2 days for '${trgTitle}'.`,
            relEntity,
            { preventDuplicates: true }
          );
        } else if (diffDays === 1) {
          await sendUserNotification(
            empId,
            orgId,
            'Employee',
            'DEADLINE_APPROACHING_1_DAY',
            '1 Day Remaining',
            `Deadline tomorrow for '${trgTitle}'.`,
            relEntity,
            { preventDuplicates: true }
          );
        } else if (diffDays === 0) {
          await sendUserNotification(
            empId,
            orgId,
            'Employee',
            'TRAINING_DUE_TODAY',
            'Training Due Today',
            `Training '${trgTitle}' is due today!`,
            relEntity,
            { preventDuplicates: true }
          );
          if (instructorId) {
            await sendInstructorNotification(
              instructorId,
              orgId,
              'TRAINING_DEADLINE_REACHED',
              'Training Deadline Reached',
              `Deadline reached for employee ${empName} on '${trgTitle}'.`,
              relEntity,
              { preventDuplicates: true }
            );
          }
          await sendAdminNotification(
            orgId,
            'TRAINING_DEADLINE_REACHED',
            'Training Deadline Reached',
            `Training '${trgTitle}' deadline reached for ${empName}.`,
            relEntity,
            { preventDuplicates: true }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error in checkTrainingDeadlines scheduler:', error);
  }
};

let schedulerInterval = null;

const initScheduler = () => {
  if (schedulerInterval) return;

  // Run immediately on boot
  checkTrainingDeadlines();

  // Run periodic check every 15 minutes (900,000 ms)
  schedulerInterval = setInterval(checkTrainingDeadlines, 15 * 60 * 1000);
  console.log('[Scheduler] Training deadline monitoring scheduler started (15-min interval).');
};

const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
};

module.exports = {
  checkTrainingDeadlines,
  initScheduler,
  stopScheduler
};
