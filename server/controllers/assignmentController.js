const { prisma, withId } = require('../config/prismaClient');
const { updateOverallProgress } = require('../services/progressService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Helper to fetch a populated assignment matching Mongoose structure
 */
const getPopulatedAssignment = async (assignmentId) => {
  const aId = String(assignmentId);
  const assignment = await prisma.assignment.findUnique({
    where: { id: aId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      training: { select: { id: true, title: true, createdBy: true } }
    }
  });

  if (!assignment) return null;
  const transformed = withId(assignment);
  if (transformed.instructor) transformed.createdBy = transformed.instructor;
  return transformed;
};

/**
 * Helper to fetch a populated submission matching Mongoose structure
 */
const getPopulatedSubmission = async (submissionId) => {
  const sId = String(submissionId);
  const sub = await prisma.assignmentSubmission.findUnique({
    where: { id: sId },
    include: {
      employee: { select: { id: true, name: true, email: true, profilePicture: true, departmentId: true, jobRole: true } },
      assignment: {
        select: {
          id: true,
          title: true,
          instructions: true,
          maxScore: true,
          trainingId: true,
          training: {
            select: {
              id: true,
              title: true,
              createdBy: true,
              instructor: { select: { id: true, name: true, email: true, profilePicture: true } },
              category: { select: { id: true, name: true } }
            }
          }
        }
      },
      reviewer: { select: { id: true, name: true, email: true, profilePicture: true } }
    }
  });

  if (!sub) return null;
  const transformed = withId(sub);
  if (transformed.employee) transformed.employeeId = transformed.employee;
  if (transformed.reviewer) transformed.reviewedBy = transformed.reviewer;
  if (transformed.assignment) {
    transformed.assignmentId = transformed.assignment;
    if (transformed.assignment.training) {
      transformed.assignmentId.trainingId = transformed.assignment.training;
      if (transformed.assignment.training.instructor) transformed.assignmentId.trainingId.createdBy = transformed.assignment.training.instructor;
      if (transformed.assignment.training.category) transformed.assignmentId.trainingId.categoryId = transformed.assignment.training.category;
    }
  }
  return transformed;
};

/**
 * @desc    Create Assignment for a SubSection
 * @route   POST /api/assignments
 * @access  Private (Instructor, Admin)
 */
const createAssignment = async (req, res, next) => {
  try {
    const { title, instructions, trainingId, sectionId, subSectionId, maxScore } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const instructorId = String(req.user.id || req.user._id);

    if (!title || !instructions || !trainingId) {
      throw new ApiError(400, 'Please provide title, instructions, and trainingId');
    }

    const trgId = String(trainingId);
    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) {
      throw new ApiError(404, 'Training not found');
    }

    if (req.user.role === 'Instructor' && training.createdBy !== instructorId) {
      throw new ApiError(403, 'Not authorized to add assignment to this training');
    }

    let targetSubSectionId = subSectionId ? String(subSectionId) : null;
    if (!targetSubSectionId && sectionId) {
      const secId = String(sectionId);
      const firstSub = await prisma.trainingSubSection.findFirst({
        where: { sectionId: secId },
        orderBy: { order: 'asc' }
      });
      if (firstSub) {
        targetSubSectionId = firstSub.id;
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        title: title.trim(),
        instructions: instructions.trim(),
        trainingId: training.id,
        subSectionId: targetSubSectionId || training.id,
        maxScore: Number(maxScore) || 100,
        createdBy: instructorId,
        organizationId: orgId
      }
    });

    if (targetSubSectionId) {
      await prisma.trainingSubSection.update({
        where: { id: targetSubSectionId },
        data: {
          hasAssignment: true,
          assignmentId: assignment.id
        }
      });
    }

    const populatedAssignment = await getPopulatedAssignment(assignment.id);

    res.status(201).json(new ApiResponse(201, { assignment: populatedAssignment }, 'Assignment created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Assignment by ID (or subSectionId / trainingId)
 * @route   GET /api/assignments/:id
 * @access  Private
 */
const getAssignmentById = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const paramId = String(req.params.id);

    let assignment = await prisma.assignment.findFirst({
      where: { id: paramId, organizationId: orgId }
    });

    if (!assignment) {
      assignment = await prisma.assignment.findFirst({
        where: { subSectionId: paramId, organizationId: orgId }
      });
    }

    if (!assignment) {
      assignment = await prisma.assignment.findFirst({
        where: { trainingId: paramId, organizationId: orgId }
      });
    }

    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }

    const populatedAssignment = await getPopulatedAssignment(assignment.id);

    // Check if current user has already submitted
    const subRecord = await prisma.assignmentSubmission.findFirst({
      where: {
        assignmentId: assignment.id,
        employeeId: userId
      }
    });

    const userSubmission = subRecord ? await getPopulatedSubmission(subRecord.id) : null;

    res.status(200).json(new ApiResponse(200, { assignment: populatedAssignment, userSubmission }, 'Assignment details retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Assignment
 * @route   PUT /api/assignments/:id
 * @access  Private (Instructor owner, Admin)
 */
const updateAssignment = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const aId = String(req.params.id);

    const assignment = await prisma.assignment.findFirst({
      where: { id: aId, organizationId: orgId }
    });
    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }

    if (req.user.role === 'Instructor' && assignment.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized to update this assignment');
    }

    const { title, instructions, maxScore } = req.body;

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (instructions) updateData.instructions = instructions.trim();
    if (maxScore) updateData.maxScore = Number(maxScore);

    await prisma.assignment.update({
      where: { id: assignment.id },
      data: updateData
    });

    const updatedAssignment = await getPopulatedAssignment(assignment.id);

    res.status(200).json(new ApiResponse(200, { assignment: updatedAssignment }, 'Assignment updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit Assignment (GitHub Link or File Upload)
 * @route   POST /api/assignments/:id/submit
 * @access  Private (Employee)
 */
const submitAssignment = async (req, res, next) => {
  try {
    const { submissionType, githubUrl, fileUrl, filePublicId, trainingAssignmentId } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const paramId = String(req.params.id);

    if (!submissionType || !['github', 'file'].includes(submissionType)) {
      throw new ApiError(400, 'Invalid submission type. Must be "github" or "file"');
    }

    if (submissionType === 'github') {
      if (!githubUrl || !githubUrl.trim()) {
        throw new ApiError(400, 'GitHub Repository URL is required');
      }
      if (!githubUrl.includes('github.com')) {
        throw new ApiError(400, 'Please enter a valid GitHub Repository URL (e.g., https://github.com/user/repository)');
      }
    }

    if (submissionType === 'file' && (!fileUrl || !fileUrl.trim())) {
      throw new ApiError(400, 'File upload is required for file submission');
    }

    let assignment = await prisma.assignment.findFirst({
      where: { id: paramId, organizationId: orgId }
    });
    if (!assignment) {
      assignment = await prisma.assignment.findFirst({
        where: { subSectionId: paramId, organizationId: orgId }
      });
    }
    if (!assignment) {
      assignment = await prisma.assignment.findFirst({
        where: { trainingId: paramId, organizationId: orgId }
      });
    }

    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }

    // Upsert employee submission
    let submission = await prisma.assignmentSubmission.findFirst({
      where: {
        assignmentId: assignment.id,
        employeeId: userId
      }
    });

    if (submission) {
      submission = await prisma.assignmentSubmission.update({
        where: { id: submission.id },
        data: {
          submissionType,
          githubUrl: githubUrl ? githubUrl.trim() : '',
          fileUrl: fileUrl ? fileUrl.trim() : '',
          filePublicId: filePublicId || '',
          status: 'submitted',
          submittedAt: new Date()
        }
      });
    } else {
      submission = await prisma.assignmentSubmission.create({
        data: {
          assignmentId: assignment.id,
          trainingAssignmentId: trainingAssignmentId ? String(trainingAssignmentId) : null,
          employeeId: userId,
          submissionType,
          githubUrl: githubUrl ? githubUrl.trim() : '',
          fileUrl: fileUrl ? fileUrl.trim() : '',
          filePublicId: filePublicId || '',
          status: 'submitted'
        }
      });
    }

    const tAssignId = trainingAssignmentId ? String(trainingAssignmentId) : null;
    if (tAssignId) {
      await updateOverallProgress(tAssignId, userId);
    }

    // Send notifications to Employee, Instructor & Admin
    const { sendUserNotification, sendInstructorNotification, sendAdminNotification } = require('../services/notificationService');
    const relEntity = { entityType: 'AssignmentSubmission', entityId: submission.id };

    await sendUserNotification(
      userId,
      orgId,
      'Employee',
      'ASSIGNMENT_SUBMITTED',
      'Assignment Submitted',
      `Assignment '${assignment.title}' submitted successfully.`,
      relEntity
    );

    await sendInstructorNotification(
      assignment.createdBy,
      orgId,
      'ASSIGNMENT_REQUIRES_REVIEW',
      'Assignment Requires Review',
      `Employee ${req.user.name} submitted assignment '${assignment.title}' for review.`,
      relEntity
    );

    await sendAdminNotification(
      orgId,
      'ASSIGNMENT_SUBMITTED',
      'Assignment Submission',
      `Assignment submitted by ${req.user.name} for '${assignment.title}'.`,
      relEntity
    );

    res.status(201).json(new ApiResponse(201, { submission: withId(submission) }, 'Assignment submitted successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Submissions for a Specific Assignment or Training
 * @route   GET /api/assignments/:id/submissions
 * @access  Private (Instructor, Admin)
 */
const getAssignmentSubmissions = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const idParam = String(req.params.id);

    let assignments = await prisma.assignment.findMany({
      where: { id: idParam, organizationId: orgId }
    });
    if (assignments.length === 0) {
      assignments = await prisma.assignment.findMany({
        where: { trainingId: idParam, organizationId: orgId }
      });
    }

    if (assignments.length === 0) {
      return res.status(200).json(new ApiResponse(200, { submissions: [] }, 'No submissions found for training'));
    }

    if (req.user.role === 'Instructor') {
      assignments = assignments.filter(a => a.createdBy === userId);
    }

    const assignmentIds = assignments.map(a => a.id);
    const submissionsList = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: { in: assignmentIds } },
      include: {
        assignment: { select: { id: true, title: true, maxScore: true, trainingId: true } },
        employee: { select: { id: true, name: true, email: true, departmentId: true, profilePicture: true } },
        reviewer: { select: { id: true, name: true, email: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });

    const submissions = submissionsList.map(s => {
      const transformed = withId(s);
      if (transformed.assignment) transformed.assignmentId = transformed.assignment;
      if (transformed.employee) transformed.employeeId = transformed.employee;
      if (transformed.reviewer) transformed.reviewedBy = transformed.reviewer;
      return transformed;
    });

    res.status(200).json(new ApiResponse(200, { submissions }, 'Assignment submissions retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get All Assignment Submissions for Logged-in Instructor
 * @route   GET /api/assignments/instructor-submissions
 * @access  Private (Instructor, Admin)
 */
const getInstructorSubmissions = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const { trainingId } = req.query;

    const ownedTrainings = await prisma.training.findMany({
      where: {
        createdBy: userId,
        organizationId: orgId,
        status: { notIn: ['archived', 'deleted'] }
      },
      select: { id: true, title: true }
    });

    const ownedTrainingIds = ownedTrainings.map(t => t.id);

    let targetTrainingIds = ownedTrainingIds;
    if (trainingId && trainingId !== 'all') {
      const paramTrgId = String(trainingId);
      targetTrainingIds = ownedTrainingIds.filter(id => id === paramTrgId);
    }

    const assignments = await prisma.assignment.findMany({
      where: {
        OR: [
          { trainingId: { in: targetTrainingIds } },
          { createdBy: userId }
        ]
      },
      select: { id: true }
    });

    const assignmentIds = assignments.map(a => a.id);

    const submissionsList = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: { in: assignmentIds } },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            training: { select: { id: true, title: true } }
          }
        },
        employee: { select: { id: true, name: true, email: true, departmentId: true, profilePicture: true } },
        reviewer: { select: { id: true, name: true, email: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });

    const submissions = submissionsList.map(s => {
      const transformed = withId(s);
      if (transformed.assignment) {
        transformed.assignmentId = transformed.assignment;
        if (transformed.assignment.training) transformed.assignmentId.trainingId = transformed.assignment.training;
      }
      if (transformed.employee) transformed.employeeId = transformed.employee;
      if (transformed.reviewer) transformed.reviewedBy = transformed.reviewer;
      return transformed;
    });

    const filteredSubmissions = trainingId && trainingId !== 'all'
      ? submissions.filter(s => String(s.assignmentId?.trainingId?.id || s.assignmentId?.trainingId?._id || s.assignmentId?.trainingId) === String(trainingId))
      : submissions;

    const totalSubmissions = filteredSubmissions.length;
    const pendingReviews = filteredSubmissions.filter(s => s.status === 'submitted').length;
    const reviewedCount = filteredSubmissions.filter(s => s.status === 'reviewed').length;

    res.status(200).json(
      new ApiResponse(
        200,
        {
          stats: {
            totalSubmissions,
            pendingReviews,
            reviewedCount
          },
          submissions: filteredSubmissions,
          trainings: withId(ownedTrainings)
        },
        'Instructor assignment submissions retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Review/Grade Assignment Submission
 * @route   PUT /api/assignments/submissions/:submissionId/review
 * @access  Private (Instructor, Admin)
 */
const reviewSubmission = async (req, res, next) => {
  try {
    const { grade, feedback, score } = req.body;
    const userId = String(req.user.id || req.user._id);
    const subId = String(req.params.submissionId);

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: subId },
      include: { assignment: true }
    });

    if (!submission) {
      throw new ApiError(404, 'Submission not found');
    }

    if (req.user.role === 'Instructor' && submission.assignment.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized to review this submission');
    }

    const validGrades = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Poor'];

    let finalGrade = submission.grade;
    if (grade && validGrades.includes(grade)) {
      finalGrade = grade;
    } else if (!finalGrade) {
      finalGrade = 'Good';
    }

    const updateData = {
      grade: finalGrade,
      status: 'reviewed',
      reviewedBy: userId,
      reviewedAt: new Date()
    };

    if (score !== undefined && !isNaN(Number(score))) {
      updateData.score = Number(score);
    }
    if (feedback !== undefined) {
      updateData.feedback = feedback.trim();
    }

    await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: updateData
    });

    const updatedSubmission = await getPopulatedSubmission(submission.id);

    // Notify Employee & Instructor
    const { sendUserNotification, sendInstructorNotification } = require('../services/notificationService');
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const relEntity = { entityType: 'AssignmentSubmission', entityId: submission.id };

    await sendUserNotification(
      submission.employeeId,
      orgId,
      'Employee',
      'ASSIGNMENT_REVIEWED',
      'Assignment Reviewed',
      `Your submission for '${submission.assignment.title}' was reviewed. Grade: ${grade || 'Graded'}.`,
      relEntity
    );

    if (req.user.id) {
      await sendInstructorNotification(
        req.user.id,
        orgId,
        'ASSIGNMENT_REVIEWED',
        'Assignment Reviewed',
        `You reviewed assignment '${submission.assignment.title}' for employee.`,
        relEntity
      );
    }

    if (feedback && feedback.trim()) {
      await sendUserNotification(
        submission.employeeId,
        orgId,
        'Employee',
        'INSTRUCTOR_FEEDBACK',
        'Instructor Feedback',
        `Instructor ${req.user.name} provided feedback on your assignment.`,
        relEntity
      );
    }

    res.status(200).json(new ApiResponse(200, { submission: updatedSubmission }, 'Submission evaluated & grade saved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get All Reviewed Assignment Feedback for Logged-in Employee
 * @route   GET /api/assignments/my-feedback
 * @access  Private (Employee)
 */
const getEmployeeFeedback = async (req, res, next) => {
  try {
    const userId = String(req.user.id || req.user._id);

    const submissionsList = await prisma.assignmentSubmission.findMany({
      where: {
        employeeId: userId,
        status: 'reviewed'
      },
      select: {
        id: true,
        assignmentId: true,
        employeeId: true,
        reviewedBy: true,
        submissionType: true,
        githubUrl: true,
        fileUrl: true,
        filePublicId: true,
        score: true,
        grade: true,
        feedback: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, name: true, email: true, profilePicture: true, departmentId: true, jobRole: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            instructions: true,
            maxScore: true,
            trainingId: true,
            training: {
              select: {
                id: true,
                title: true,
                createdBy: true,
                instructor: { select: { id: true, name: true, email: true, profilePicture: true } },
                category: { select: { id: true, name: true } }
              }
            }
          }
        },
        reviewer: { select: { id: true, name: true, email: true, profilePicture: true } }
      },
      orderBy: { reviewedAt: 'desc' }
    });

    const submissions = submissionsList.map(sub => {
      const transformed = withId(sub);
      if (transformed.employee) transformed.employeeId = transformed.employee;
      if (transformed.reviewer) transformed.reviewedBy = transformed.reviewer;
      if (transformed.assignment) {
        transformed.assignmentId = transformed.assignment;
        if (transformed.assignment.training) {
          transformed.assignmentId.trainingId = transformed.assignment.training;
          if (transformed.assignment.training.instructor) transformed.assignmentId.trainingId.createdBy = transformed.assignment.training.instructor;
          if (transformed.assignment.training.category) transformed.assignmentId.trainingId.categoryId = transformed.assignment.training.category;
        }
      }
      return transformed;
    });

    res.status(200).json(
      new ApiResponse(
        200,
        { submissions },
        'Employee reviewed assignment feedback retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAssignment,
  getAssignmentById,
  updateAssignment,
  submitAssignment,
  getAssignmentSubmissions,
  getInstructorSubmissions,
  getEmployeeFeedback,
  reviewSubmission
};
