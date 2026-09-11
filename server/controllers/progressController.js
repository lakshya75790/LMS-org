const { prisma, withId } = require('../config/prismaClient');
const { updateOverallProgress } = require('../services/progressService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Mark SubSection (Video/Text Lesson) as Completed & Recalculate Progress
 * @route   POST /api/progress/complete-subsection
 * @access  Private (Employee)
 */
const completeSubSection = async (req, res, next) => {
  try {
    const { trainingAssignmentId, subSectionId } = req.body;
    const userId = String(req.user.id || req.user._id);

    if (!trainingAssignmentId || !subSectionId) {
      throw new ApiError(400, 'trainingAssignmentId and subSectionId are required');
    }

    const tAssignId = String(trainingAssignmentId);
    const subSecId = String(subSectionId);

    const assignment = await prisma.trainingAssignment.findFirst({
      where: {
        id: tAssignId,
        employeeId: userId
      }
    });

    if (!assignment) {
      throw new ApiError(404, 'Training assignment not found');
    }

    if (assignment.isLocked) {
      throw new ApiError(403, 'This training is locked by your instructor. You cannot continue learning until unlocked.');
    }

    const training = await prisma.training.findUnique({
      where: { id: assignment.trainingId },
      include: {
        sections: {
          include: { subSections: true }
        }
      }
    });

    if (!training) {
      throw new ApiError(404, 'Training details not found');
    }

    // Locate subSection in training sections
    let targetSubSection = null;
    training.sections.forEach(section => {
      section.subSections.forEach(sub => {
        if (sub.id === subSecId) {
          targetSubSection = sub;
        }
      });
    });

    if (!targetSubSection) {
      throw new ApiError(404, 'Sub-section not found in training');
    }

    // Fetch or create TrainingProgress record
    let progress = await prisma.trainingProgress.findUnique({
      where: { trainingAssignmentId: assignment.id }
    });

    const completedList = progress && Array.isArray(progress.completedSubSectionIds)
      ? progress.completedSubSectionIds
      : [];
    const isAlreadyCompleted = completedList.includes(subSecId);

    // Enforce 100% video progress requirement for uncompleted video lessons
    const isVideoLesson = Boolean(targetSubSection.videoUrl && targetSubSection.videoUrl.trim() !== '');
    if (isVideoLesson && !isAlreadyCompleted) {
      const submittedProgress = Number(req.body.videoProgress ?? req.body.progress ?? 0);
      if (isNaN(submittedProgress) || submittedProgress < 100) {
        throw new ApiError(400, 'Video lesson progress must reach 100% before marking as complete');
      }
    }

    if (!progress) {
      progress = await prisma.trainingProgress.create({
        data: {
          trainingAssignmentId: assignment.id,
          employeeId: userId,
          trainingId: training.id,
          completedSubSectionIds: [subSecId],
          lastAccessedSubSectionId: subSecId,
          progressPercentage: 0
        }
      });
    } else {
      const completedList = Array.isArray(progress.completedSubSectionIds) ? progress.completedSubSectionIds : [];
      const updatedCompletedList = completedList.includes(subSecId)
        ? completedList
        : [...completedList, subSecId];

      progress = await prisma.trainingProgress.update({
        where: { id: progress.id },
        data: {
          completedSubSectionIds: updatedCompletedList,
          lastAccessedSubSectionId: subSecId
        }
      });
    }

    // Recalculate overall progress dynamically via progressService
    const result = await updateOverallProgress(assignment.id, userId);

    const finalProgress = result ? result.progress : withId(progress);
    const finalAssignment = result ? result.assignment : withId(assignment);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          progress: finalProgress,
          assignmentStatus: finalAssignment.status,
          percentage: finalAssignment.progressPercentage
        },
        finalAssignment.progressPercentage === 100 ? 'Training completed!' : 'Lesson marked complete successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Training Progress for an Assignment
 * @route   GET /api/progress/:trainingAssignmentId
 * @access  Private
 */
const getProgressByAssignment = async (req, res, next) => {
  try {
    const tAssignId = String(req.params.trainingAssignmentId);
    const userId = String(req.user.id || req.user._id);

    let assignmentRecord = await prisma.trainingAssignment.findUnique({
      where: { id: tAssignId },
      include: {
        training: {
          include: {
            category: { select: { id: true, name: true } },
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
        employee: { select: { id: true, name: true, email: true } }
      }
    });

    if (!assignmentRecord) {
      assignmentRecord = await prisma.trainingAssignment.findFirst({
        where: { trainingId: tAssignId, employeeId: userId },
        include: {
          training: {
            include: {
              category: { select: { id: true, name: true } },
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
          employee: { select: { id: true, name: true, email: true } }
        }
      });
    }

    if (!assignmentRecord) {
      throw new ApiError(404, 'Training assignment not found');
    }

    await updateOverallProgress(assignmentRecord.id, userId).catch(err => console.error('Error updating overall progress in getProgressByAssignment:', err));

    const updatedAssignmentRecord = await prisma.trainingAssignment.findUnique({
      where: { id: assignmentRecord.id },
      include: {
        training: {
          include: {
            category: { select: { id: true, name: true } },
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
        employee: { select: { id: true, name: true, email: true } }
      }
    });

    if (updatedAssignmentRecord) {
      assignmentRecord = updatedAssignmentRecord;
    }

    const assignment = withId(assignmentRecord);
    if (assignment.training) {
      assignment.trainingId = assignment.training;
      if (assignment.training.category) assignment.trainingId.categoryId = assignment.training.category;

      if (Array.isArray(assignment.trainingId.sections)) {
        assignment.trainingId.sections = assignment.trainingId.sections.map(sec => {
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

              // Check matching quiz
              const matchingQuiz = assignmentRecord.training.quizzes?.find(q => q.subSectionId === sub.id);
              if (matchingQuiz || sub.hasQuiz || sub.quizId) {
                transformedSub.hasQuiz = true;
                transformedSub.quizId = matchingQuiz ? withId(matchingQuiz) : sub.quizId;
              } else {
                transformedSub.hasQuiz = false;
              }

              // Check matching assignment
              const matchingAssignment = assignmentRecord.training.assignments?.find(a => a.subSectionId === sub.id);
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

      // Attach main course assignment if present
      const mainAssignment = assignmentRecord.training.assignments?.find(a => !a.subSectionId);
      if (mainAssignment) {
        assignment.trainingId.assignmentId = withId(mainAssignment);
      }
    }
    if (assignment.employee) assignment.employeeId = assignment.employee;

    const progressRecord = await prisma.trainingProgress.findUnique({
      where: { trainingAssignmentId: assignmentRecord.id }
    });

    const progress = progressRecord ? withId(progressRecord) : {
      completedSubSectionIds: [],
      progressPercentage: assignmentRecord.progressPercentage,
      lastAccessedSubSectionId: null
    };

    // Fetch ALL completed quiz attempts for this employee
    const quizAttemptsList = await prisma.quizAttempt.findMany({
      where: {
        employeeId: userId,
        status: { not: 'in_progress' }
      },
      include: {
        answers: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const quizAttempts = withId(quizAttemptsList);

    // Fetch assignment submissions
    const submissionsList = await prisma.assignmentSubmission.findMany({
      where: {
        employeeId: userId
      }
    });

    const assignmentSubmissions = withId(submissionsList);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          assignment,
          progress,
          quizAttempts,
          assignmentSubmissions
        },
        'Progress retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  completeSubSection,
  getProgressByAssignment
};
