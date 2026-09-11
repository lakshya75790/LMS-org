const { prisma, withId } = require('../config/prismaClient');

/**
 * @desc Recalculate overall employee progress percentage and update TrainingAssignment status in PostgreSQL via Prisma
 */
const updateOverallProgress = async (trainingAssignmentId, employeeId) => {
  try {
    const tAssignId = String(trainingAssignmentId);
    const empId = String(employeeId);

    const assignment = await prisma.trainingAssignment.findFirst({
      where: {
        id: tAssignId,
        employeeId: empId
      }
    });

    if (!assignment) return null;

    const training = await prisma.training.findUnique({
      where: { id: assignment.trainingId },
      include: {
        sections: {
          include: {
            subSections: true
          }
        },
        quizzes: true,
        assignments: true
      }
    });
    if (!training) return null;

    // Collect all required item IDs across training sections & syllabus structure
    let totalSubSections = 0;
    const requiredQuizIds = new Set();
    const requiredAssignmentIds = new Set();

    if (training.quizzes && Array.isArray(training.quizzes)) {
      training.quizzes.forEach(q => requiredQuizIds.add(String(q.id)));
    }
    if (training.assignments && Array.isArray(training.assignments)) {
      training.assignments.forEach(a => requiredAssignmentIds.add(String(a.id)));
    }

    training.sections?.forEach(sec => {
      sec.subSections?.forEach(sub => {
        if (sub.quizId || sub.hasQuiz) {
          if (sub.quizId) requiredQuizIds.add(String(sub.quizId));
        } else if (sub.assignmentId || sub.hasAssignment) {
          if (sub.assignmentId) requiredAssignmentIds.add(String(sub.assignmentId));
        } else {
          totalSubSections++;
        }
      });
    });

    const totalRequiredCount = totalSubSections + requiredQuizIds.size + requiredAssignmentIds.size;
    if (totalRequiredCount === 0) return withId(assignment);

    // Fetch or create employee progress record
    let progress = await prisma.trainingProgress.findUnique({
      where: { trainingAssignmentId: assignment.id }
    });

    if (!progress) {
      progress = await prisma.trainingProgress.create({
        data: {
          trainingAssignmentId: assignment.id,
          employeeId: empId,
          trainingId: training.id,
          completedSubSectionIds: [],
          progressPercentage: 0
        }
      });
    }

    const completedSubSectionSet = new Set((progress.completedSubSectionIds || []).map(id => String(id)));
    let completedSubSectionCount = 0;

    training.sections?.forEach(sec => {
      sec.subSections?.forEach(sub => {
        if (!sub.quizId && !sub.hasQuiz && !sub.assignmentId && !sub.hasAssignment) {
          if (completedSubSectionSet.has(String(sub.id))) {
            completedSubSectionCount++;
          }
        }
      });
    });

    // Count passed quizzes
    let passedQuizCount = 0;
    if (requiredQuizIds.size > 0) {
      const reqQArr = Array.from(requiredQuizIds);
      const passedQuizAttempts = await prisma.quizAttempt.findMany({
        where: {
          employeeId: empId,
          passed: true,
          OR: [
            { quizId: { in: reqQArr } },
            { trainingAssignmentId: assignment.id }
          ]
        }
      });

      const uniquePassedQuizIds = new Set();
      passedQuizAttempts.forEach(a => {
        if (a.quizId) uniquePassedQuizIds.add(String(a.quizId));
      });
      passedQuizCount = Math.min(
        requiredQuizIds.size,
        uniquePassedQuizIds.size > 0 ? uniquePassedQuizIds.size : (passedQuizAttempts.length > 0 ? requiredQuizIds.size : 0)
      );
    }

    // Count submitted assignments
    let submittedAssignmentCount = 0;
    if (requiredAssignmentIds.size > 0) {
      const reqAArr = Array.from(requiredAssignmentIds);
      const submissions = await prisma.assignmentSubmission.findMany({
        where: {
          employeeId: empId,
          status: { in: ['submitted', 'reviewed'] },
          OR: [
            { assignmentId: { in: reqAArr } },
            { trainingAssignmentId: assignment.id }
          ]
        }
      });

      const uniqueSubmittedAssignmentIds = new Set();
      submissions.forEach(s => {
        if (s.assignmentId) uniqueSubmittedAssignmentIds.add(String(s.assignmentId));
      });
      submittedAssignmentCount = Math.min(
        requiredAssignmentIds.size,
        uniqueSubmittedAssignmentIds.size > 0 ? uniqueSubmittedAssignmentIds.size : (submissions.length > 0 ? requiredAssignmentIds.size : 0)
      );
    }

    const allSubSectionsCompleted = completedSubSectionCount >= totalSubSections;
    const allRequiredQuizzesPassed = requiredQuizIds.size === 0 || passedQuizCount >= requiredQuizIds.size;
    const allRequiredAssignmentsSubmitted = requiredAssignmentIds.size === 0 || submittedAssignmentCount >= requiredAssignmentIds.size;

    const allEverythingCompleted = allSubSectionsCompleted && allRequiredQuizzesPassed && allRequiredAssignmentsSubmitted;

    let newPercentage = 0;

    if (allEverythingCompleted) {
      newPercentage = 100;
    } else {
      const rawCompletedCount = Math.min(
        totalRequiredCount - 1,
        completedSubSectionCount + passedQuizCount + submittedAssignmentCount
      );
      newPercentage = Math.min(99, Math.round((rawCompletedCount / totalRequiredCount) * 100));
    }

    // Update progress percentage
    progress = await prisma.trainingProgress.update({
      where: { id: progress.id },
      data: { progressPercentage: newPercentage }
    });

    // Update training assignment status and progress percentage
    let newStatus = assignment.status;
    let completedDate = assignment.completedDate;

    const isNewlyCompleted = newPercentage === 100 && allEverythingCompleted && assignment.status !== 'Completed';

    if (newPercentage === 100 && allEverythingCompleted) {
      newStatus = 'Completed';
      completedDate = completedDate || new Date();
    } else {
      if (assignment.status === 'Completed') {
        newStatus = 'In Progress';
      } else if (assignment.status === 'Assigned' && (completedSubSectionCount > 0 || passedQuizCount > 0 || submittedAssignmentCount > 0)) {
        newStatus = 'In Progress';
      }
    }

    const updatedAssignment = await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: {
        progressPercentage: newPercentage,
        status: newStatus,
        completedDate
      }
    });

    const isNewlyStarted = assignment.status === 'Assigned' && newStatus === 'In Progress';

    if (isNewlyStarted) {
      const { sendUserNotification, sendInstructorNotification } = require('./notificationService');
      const employee = await prisma.user.findUnique({
        where: { id: empId },
        select: { name: true }
      });
      const empName = employee?.name || 'Employee';

      await sendUserNotification(
        empId,
        assignment.organizationId,
        'Employee',
        'TRAINING_STARTED',
        'Training Started',
        `You started training '${training.title}'. Keep going!`,
        { entityType: 'Training', entityId: training.id },
        { preventDuplicates: true }
      );

      if (training.createdBy) {
        await sendInstructorNotification(
          training.createdBy,
          assignment.organizationId,
          'EMPLOYEE_STARTED_TRAINING',
          'Employee Started Training',
          `Employee ${empName} started training '${training.title}'.`,
          { entityType: 'Training', entityId: training.id },
          { preventDuplicates: true }
        );
      }
    }

    if (isNewlyCompleted) {
      // Automatically generate certificate for completed training
      try {
        const { generateCertificateForAssignment } = require('./certificateService');
        await generateCertificateForAssignment(updatedAssignment.id);
      } catch (certErr) {
        console.error('Failed to generate certificate on training completion:', certErr);
      }

      const { sendUserNotification, sendInstructorNotification, sendAdminNotification } = require('./notificationService');
      const employee = await prisma.user.findUnique({
        where: { id: empId },
        select: { name: true }
      });
      const empName = employee?.name || 'Employee';

      await sendUserNotification(
        empId,
        assignment.organizationId,
        'Employee',
        'TRAINING_COMPLETED',
        'Training Completed',
        `Congratulations! You have completed '${training.title}'.`,
        { entityType: 'Training', entityId: training.id },
        { preventDuplicates: true }
      );

      if (training.createdBy) {
        await sendInstructorNotification(
          training.createdBy,
          assignment.organizationId,
          'EMPLOYEE_COMPLETED_TRAINING',
          'Learner Training Completed',
          `Learner ${empName} completed your training: '${training.title}'.`,
          { entityType: 'Training', entityId: training.id },
          { preventDuplicates: true }
        );
      }

      await sendAdminNotification(
        assignment.organizationId,
        'EMPLOYEE_COMPLETED_TRAINING',
        'Employee Training Completed',
        `Employee ${empName} completed assigned training: '${training.title}'.`,
        { entityType: 'Training', entityId: training.id },
        { preventDuplicates: true }
      );

      // Check if employee completed ALL required trainings in org
      const remainingIncomplete = await prisma.trainingAssignment.count({
        where: {
          employeeId: empId,
          organizationId: assignment.organizationId,
          status: { notIn: ['Completed'] }
        }
      });

      if (remainingIncomplete === 0) {
        await sendAdminNotification(
          assignment.organizationId,
          'EMPLOYEE_COMPLETED_ALL_REQUIRED_TRAINING',
          'Employee Completed All Required Training',
          `Employee ${empName} has completed all required training in your organization!`,
          { entityType: 'User', entityId: empId },
          { preventDuplicates: true }
        );
      }
    }

    return {
      progress: withId(progress),
      assignment: withId(updatedAssignment)
    };
  } catch (err) {
    console.error('Error updating overall progress:', err);
    return null;
  }
};

module.exports = {
  updateOverallProgress
};
