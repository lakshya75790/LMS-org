const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Helper to fetch a populated training record matching the Mongoose structure expected by frontend
 */
const getPopulatedTraining = async (trainingId) => {
  const trgId = String(trainingId);
  const training = await prisma.training.findUnique({
    where: { id: trgId },
    include: {
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true, jobRoles: true } },
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
  });

  if (!training) return null;

  const transformed = withId(training);
  if (transformed.category) transformed.categoryId = transformed.category;
  if (transformed.department) transformed.departmentId = transformed.department;
  if (transformed.instructor) transformed.createdBy = transformed.instructor;

  if (transformed.sections && Array.isArray(transformed.sections)) {
    transformed.sections = transformed.sections.map(sec => {
      if (sec.subSections && Array.isArray(sec.subSections)) {
        sec.subSections = sec.subSections.map(sub => {
          sub.pdfResources = (sub.pdfResources || []).map(r => {
            const transformedPdf = withId(r);
            transformedPdf.fileUrl = r.pdfUrl || r.fileUrl || '';
            transformedPdf.filePublicId = r.pdfPublicId || r.filePublicId || '';
            return transformedPdf;
          });
          const matchingQuiz = training.quizzes?.find(q => q.subSectionId === sub.id);
          if (matchingQuiz || sub.hasQuiz || sub.quizId) {
            sub.hasQuiz = true;
            sub.quizId = matchingQuiz ? withId(matchingQuiz) : sub.quizId;
          } else {
            sub.hasQuiz = false;
          }

          const matchingAssignment = training.assignments?.find(a => a.subSectionId === sub.id);
          if (matchingAssignment || sub.hasAssignment || sub.assignmentId || sub.assignment) {
            sub.hasAssignment = true;
            sub.assignmentId = matchingAssignment ? withId(matchingAssignment) : (sub.assignment ? withId(sub.assignment) : sub.assignmentId);
          } else {
            sub.hasAssignment = false;
          }
          return sub;
        });
      }
      return sec;
    });
  }

  const mainAssignment = training.assignments?.find(a => !a.subSectionId);
  if (mainAssignment) {
    transformed.assignmentId = withId(mainAssignment);
  }

  return transformed;
};

/**
 * Helper to recalculate and update progress for all employees enrolled in a training after an edit
 */
const reconcileTrainingProgress = async (trainingId) => {
  try {
    const trgId = String(trainingId);

    // Fetch updated training structure (active subSections, quizzes, assignments)
    const training = await prisma.training.findUnique({
      where: { id: trgId },
      include: {
        sections: {
          include: {
            subSections: { select: { id: true } }
          }
        },
        quizzes: { select: { id: true, subSectionId: true } },
        assignments: { select: { id: true, subSectionId: true } }
      }
    });

    if (!training) return;

    const validSubSectionIds = new Set(
      training.sections.flatMap(sec => sec.subSections.map(sub => sub.id))
    );

    const hasQuiz = training.quizzes && training.quizzes.length > 0;
    const hasAssignment = training.assignments && training.assignments.length > 0;
    const totalRequiredItems = validSubSectionIds.size + (hasQuiz ? 1 : 0) + (hasAssignment ? 1 : 0);

    const allProgressRecords = await prisma.trainingProgress.findMany({
      where: { trainingId: trgId }
    });

    for (const progressRec of allProgressRecords) {
      const currentCompleted = Array.isArray(progressRec.completedSubSectionIds)
        ? progressRec.completedSubSectionIds
        : [];

      // Keep only subSection IDs that still exist in validSubSectionIds
      const validCompletedIds = currentCompleted.filter(id => validSubSectionIds.has(id));

      // Check if employee passed any quiz for this training
      let passedQuizCount = 0;
      if (hasQuiz) {
        const passedAttempt = await prisma.quizAttempt.findFirst({
          where: {
            trainingAssignmentId: progressRec.trainingAssignmentId,
            passed: true
          }
        });
        if (passedAttempt) passedQuizCount = 1;
      }

      // Check if employee submitted any assignment for this training
      let submittedAssignmentCount = 0;
      if (hasAssignment) {
        const submission = await prisma.assignmentSubmission.findFirst({
          where: { trainingAssignmentId: progressRec.trainingAssignmentId }
        });
        if (submission) submittedAssignmentCount = 1;
      }

      const completedItemsCount = validCompletedIds.length + passedQuizCount + submittedAssignmentCount;

      const newPercentage = totalRequiredItems > 0
        ? (completedItemsCount === totalRequiredItems ? 100 : Math.round((completedItemsCount / totalRequiredItems) * 100))
        : 0;

      const newStatus = newPercentage === 100 ? 'Completed' : (completedItemsCount > 0 ? 'In Progress' : 'Assigned');

      await prisma.trainingProgress.update({
        where: { id: progressRec.id },
        data: {
          completedSubSectionIds: validCompletedIds,
          progressPercentage: newPercentage
        }
      });

      await prisma.trainingAssignment.update({
        where: { id: progressRec.trainingAssignmentId },
        data: {
          progressPercentage: newPercentage,
          status: newStatus,
          completedDate: newPercentage === 100 ? new Date() : null
        }
      });
    }
  } catch (err) {
    console.error('Error reconciling training progress after edit:', err);
  }
};

/**
 * @desc    Save/Update Full Course Structure (Sections, Lectures, Quiz, Assignment, Resources, Draft/Published Status)
 * @route   POST /api/trainings/save-full-course
 * @access  Private (Instructor owner, Admin)
 */
const saveFullCourse = async (req, res, next) => {
  try {
    const {
      trainingId,
      title,
      description,
      categoryId,
      thumbnailUrl,
      thumbnailPublicId,
      benefits,
      durationDays,
      status, // 'draft' | 'published'
      sections, // Array of sections with lectures, quiz
      assignment, // Optional assignment { title, instructions }
      resources // Optional PDF resources [{ title, fileUrl, filePublicId }]
    } = req.body;

    if (!title || !categoryId) {
      throw new ApiError(400, 'Training title and category are required');
    }

    const isPublished = status === 'published';
    const isMandatory = req.user.role === 'Admin' ? Boolean(req.body.isMandatory) : false;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const instructorId = String(req.user.id || req.user._id);

    let training;

    if (trainingId) {
      const trgId = String(trainingId);
      training = await prisma.training.findFirst({
        where: { id: trgId, organizationId: orgId }
      });
      if (!training) throw new ApiError(404, 'Training not found');
      if (req.user.role === 'Instructor' && training.createdBy !== instructorId) {
        throw new ApiError(403, 'Not authorized to update this training');
      }

      training = await prisma.training.update({
        where: { id: training.id },
        data: {
          title: title.trim(),
          description: (description || title).trim(),
          categoryId: String(categoryId),
          thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : training.thumbnailUrl,
          thumbnailPublicId: thumbnailPublicId !== undefined ? thumbnailPublicId : training.thumbnailPublicId,
          benefits: Array.isArray(benefits) ? benefits : [],
          durationDays: Number(durationDays) || 30,
          status: status || training.status,
          isPublished: isPublished !== undefined ? isPublished : training.isPublished,
          isMandatory: req.user.role === 'Admin' && isMandatory !== undefined ? isMandatory : training.isMandatory
        }
      });
    } else {
      // Backend idempotency check: prevent duplicate creation if identical title submitted within last 15 seconds
      const recentDuplicate = await prisma.training.findFirst({
        where: {
          createdBy: instructorId,
          organizationId: orgId,
          title: title.trim(),
          status: { notIn: ['archived', 'deleted'] },
          createdAt: { gte: new Date(Date.now() - 15000) }
        }
      });
      if (recentDuplicate) {
        const populatedDuplicate = await getPopulatedTraining(recentDuplicate.id);
        return res.status(200).json(
          new ApiResponse(200, { training: populatedDuplicate }, 'Training already submitted')
        );
      }

      training = await prisma.training.create({
        data: {
          title: title.trim(),
          description: (description || title).trim(),
          categoryId: String(categoryId),
          createdBy: instructorId,
          organizationId: orgId,
          thumbnailUrl: thumbnailUrl || '',
          thumbnailPublicId: thumbnailPublicId || '',
          benefits: Array.isArray(benefits) ? benefits : [],
          durationDays: Number(durationDays) || 30,
          status: status || 'draft',
          isPublished,
          isMandatory
        }
      });
    }

    // Reconcile Sections & SubSections (In-place update to preserve subsection UUIDs and progress!)
    const existingSections = await prisma.trainingSection.findMany({
      where: { trainingId: training.id },
      include: { subSections: true }
    });

    const activeSectionIds = [];
    const activeSubSectionIds = [];

    if (sections && Array.isArray(sections)) {
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        let currentSec;

        const secId = sec.id || sec._id;
        const existingSec = secId
          ? existingSections.find(s => s.id === secId)
          : (existingSections[i] || null);

        if (existingSec) {
          currentSec = await prisma.trainingSection.update({
            where: { id: existingSec.id },
            data: {
              title: sec.title || `Section ${i + 1}`,
              description: sec.description || '',
              order: i + 1
            }
          });
        } else {
          currentSec = await prisma.trainingSection.create({
            data: {
              trainingId: training.id,
              title: sec.title || `Section ${i + 1}`,
              description: sec.description || '',
              order: i + 1
            }
          });
        }
        activeSectionIds.push(currentSec.id);

        const lecturesList = sec.lectures && sec.lectures.length > 0
          ? sec.lectures
          : [{ title: `${sec.title} Lecture 1`, description: sec.description || '' }];

        const existingSubSecs = existingSec ? (existingSec.subSections || []) : [];

        for (let j = 0; j < lecturesList.length; j++) {
          const lec = lecturesList[j];
          let currentSubSec;

          const lecId = lec.id || lec._id;
          const existingSub = lecId
            ? existingSubSecs.find(sub => sub.id === lecId)
            : (existingSubSecs[j] || null);

          if (existingSub) {
            currentSubSec = await prisma.trainingSubSection.update({
              where: { id: existingSub.id },
              data: {
                title: lec.title || `Lecture ${j + 1}`,
                description: lec.description || '',
                order: j + 1,
                videoUrl: lec.videoUrl || '',
                videoPublicId: lec.videoPublicId || '',
                videoDuration: Number(lec.videoDuration) || 0
              }
            });
          } else {
            currentSubSec = await prisma.trainingSubSection.create({
              data: {
                sectionId: currentSec.id,
                title: lec.title || `Lecture ${j + 1}`,
                description: lec.description || '',
                order: j + 1,
                videoUrl: lec.videoUrl || '',
                videoPublicId: lec.videoPublicId || '',
                videoDuration: Number(lec.videoDuration) || 0,
                hasQuiz: false,
                hasAssignment: false
              }
            });
          }
          activeSubSectionIds.push(currentSubSec.id);

          // Handle Quiz for section 0 lecture 0
          if (sec.quiz && sec.quiz.questions && sec.quiz.questions.length > 0 && j === 0) {
            const existingQuiz = await prisma.quiz.findFirst({
              where: { trainingId: training.id }
            });

            if (existingQuiz) {
              await prisma.quizQuestion.deleteMany({ where: { quizId: existingQuiz.id } });
              const updatedQuiz = await prisma.quiz.update({
                where: { id: existingQuiz.id },
                data: {
                  title: sec.quiz.title || `${sec.title} Quiz`,
                  subSectionId: currentSubSec.id,
                  timeLimitMinutes: Number(sec.quiz.timeLimitMinutes) || 15,
                  passingScorePercent: Number(sec.quiz.passingScorePercent) || 70,
                  questions: {
                    create: sec.quiz.questions.map(q => {
                      const qType = q.questionType || (q.options && q.options.length > 0 ? 'MCQ' : 'FILL_IN_BLANK');
                      if (qType === 'TRUE_FALSE') {
                        const idx = Number(q.correctAnswerIndex) === 1 ? 1 : 0;
                        const txt = q.correctAnswerText || (idx === 0 ? 'True' : 'False');
                        return {
                          questionText: q.questionText,
                          questionType: 'TRUE_FALSE',
                          options: ['True', 'False'],
                          correctAnswerIndex: idx,
                          correctAnswerText: txt
                        };
                      } else if (qType === 'FILL_IN_BLANK') {
                        return {
                          questionText: q.questionText,
                          questionType: 'FILL_IN_BLANK',
                          options: [],
                          correctAnswerIndex: null,
                          correctAnswerText: (q.correctAnswerText || '').trim()
                        };
                      } else {
                        const opts = Array.isArray(q.options) ? q.options : [];
                        const idx = q.correctAnswerIndex !== undefined && q.correctAnswerIndex !== null ? Number(q.correctAnswerIndex) : 0;
                        const txt = q.correctAnswerText || (opts[idx] || '');
                        return {
                          questionText: q.questionText,
                          questionType: 'MCQ',
                          options: opts,
                          correctAnswerIndex: idx,
                          correctAnswerText: txt
                        };
                      }
                    })
                  }
                }
              });

              await prisma.trainingSubSection.update({
                where: { id: currentSubSec.id },
                data: { hasQuiz: true, quizId: updatedQuiz.id }
              });
            } else {
              const newQuiz = await prisma.quiz.create({
                data: {
                  title: sec.quiz.title || `${sec.title} Quiz`,
                  trainingId: training.id,
                  subSectionId: currentSubSec.id,
                  timeLimitMinutes: Number(sec.quiz.timeLimitMinutes) || 15,
                  passingScorePercent: Number(sec.quiz.passingScorePercent) || 70,
                  createdBy: instructorId,
                  organizationId: orgId,
                  questions: {
                    create: sec.quiz.questions.map(q => {
                      const qType = q.questionType || (q.options && q.options.length > 0 ? 'MCQ' : 'FILL_IN_BLANK');
                      if (qType === 'TRUE_FALSE') {
                        const idx = Number(q.correctAnswerIndex) === 1 ? 1 : 0;
                        const txt = q.correctAnswerText || (idx === 0 ? 'True' : 'False');
                        return {
                          questionText: q.questionText,
                          questionType: 'TRUE_FALSE',
                          options: ['True', 'False'],
                          correctAnswerIndex: idx,
                          correctAnswerText: txt
                        };
                      } else if (qType === 'FILL_IN_BLANK') {
                        return {
                          questionText: q.questionText,
                          questionType: 'FILL_IN_BLANK',
                          options: [],
                          correctAnswerIndex: null,
                          correctAnswerText: (q.correctAnswerText || '').trim()
                        };
                      } else {
                        const opts = Array.isArray(q.options) ? q.options : [];
                        const idx = q.correctAnswerIndex !== undefined && q.correctAnswerIndex !== null ? Number(q.correctAnswerIndex) : 0;
                        const txt = q.correctAnswerText || (opts[idx] || '');
                        return {
                          questionText: q.questionText,
                          questionType: 'MCQ',
                          options: opts,
                          correctAnswerIndex: idx,
                          correctAnswerText: txt
                        };
                      }
                    })
                  }
                }
              });

              await prisma.trainingSubSection.update({
                where: { id: currentSubSec.id },
                data: { hasQuiz: true, quizId: newQuiz.id }
              });
            }
          }

          // Handle PDF Resources for section 0 lecture 0
          if (resources && resources.length > 0 && i === 0 && j === 0) {
            await prisma.pdfResource.deleteMany({
              where: { subSectionId: currentSubSec.id }
            });
            for (const r of resources) {
              await prisma.pdfResource.create({
                data: {
                  subSectionId: currentSubSec.id,
                  title: r.title || r.name || r.originalName || 'Resource PDF',
                  pdfUrl: r.pdfUrl || r.fileUrl || r.url || '',
                  pdfPublicId: r.pdfPublicId || r.filePublicId || r.publicId || '',
                  originalName: r.originalName || r.name || r.title || 'Resource PDF'
                }
              });
            }
          }
        }
      }

      // Clean up deleted subSections & sections
      if (trainingId) {
        const removedSubSecs = await prisma.trainingSubSection.findMany({
          where: {
            section: { trainingId: training.id },
            id: { notIn: activeSubSectionIds }
          },
          select: { id: true }
        });
        if (removedSubSecs.length > 0) {
          await prisma.trainingSubSection.deleteMany({
            where: { id: { in: removedSubSecs.map(s => s.id) } }
          });
        }

        const removedSecs = await prisma.trainingSection.findMany({
          where: {
            trainingId: training.id,
            id: { notIn: activeSectionIds }
          },
          select: { id: true }
        });
        if (removedSecs.length > 0) {
          await prisma.trainingSection.deleteMany({
            where: { id: { in: removedSecs.map(s => s.id) } }
          });
        }
      }
    }

    // Attach Assignment to the last subSection if provided
    if (assignment && assignment.instructions) {
      const allSubSections = await prisma.trainingSubSection.findMany({
        where: { section: { trainingId: training.id } },
        orderBy: [{ section: { order: 'desc' } }, { order: 'desc' }]
      });

      if (allSubSections.length > 0) {
        const lastSubSec = allSubSections[0];
        const existingAssignment = await prisma.assignment.findFirst({
          where: { trainingId: training.id }
        });

        if (existingAssignment) {
          await prisma.assignment.update({
            where: { id: existingAssignment.id },
            data: {
              title: assignment.title || `${title} Assignment`,
              instructions: assignment.instructions,
              subSectionId: lastSubSec.id
            }
          });
          await prisma.trainingSubSection.update({
            where: { id: lastSubSec.id },
            data: { hasAssignment: true, assignmentId: existingAssignment.id }
          });
        } else {
          const newAssignment = await prisma.assignment.create({
            data: {
              title: assignment.title || `${title} Assignment`,
              instructions: assignment.instructions,
              trainingId: training.id,
              subSectionId: lastSubSec.id,
              maxScore: 100,
              createdBy: instructorId,
              organizationId: orgId
            }
          });

          await prisma.trainingSubSection.update({
            where: { id: lastSubSec.id },
            data: { hasAssignment: true, assignmentId: newAssignment.id }
          });
        }
      }
    }

    // Reconcile employee progress & training assignments
    if (trainingId) {
      await reconcileTrainingProgress(training.id);
    }

    const populatedTraining = await getPopulatedTraining(training.id);

    const { sendUserNotification, sendAdminNotification } = require('../services/notificationService');

    if (!trainingId) {
      await sendAdminNotification(
        orgId,
        'NEW_TRAINING_CREATED',
        'New Training Created',
        `Instructor ${req.user.name || 'Instructor'} created a new training: ${title}.`,
        { entityType: 'Training', entityId: training.id }
      );
      if (training.createdBy) {
        await sendUserNotification(
          training.createdBy,
          orgId,
          'Instructor',
          'TRAINING_CREATED',
          'Training Created',
          `Your training '${title}' was created successfully.`,
          { entityType: 'Training', entityId: training.id }
        );
      }
    } else {
      if (training.createdBy) {
        await sendUserNotification(
          training.createdBy,
          orgId,
          'Instructor',
          'TRAINING_UPDATED',
          'Training Updated',
          `Training '${title}' details updated.`,
          { entityType: 'Training', entityId: training.id }
        );
      }
    }

    if (isPublished) {
      await sendAdminNotification(
        orgId,
        'TRAINING_PUBLISHED',
        'Training Published',
        `Training '${title}' is now published.`,
        { entityType: 'Training', entityId: training.id }
      );
      if (training.createdBy) {
        await sendUserNotification(
          training.createdBy,
          orgId,
          'Instructor',
          'TRAINING_PUBLISHED',
          'Training Published',
          `Your training '${title}' is now published.`,
          { entityType: 'Training', entityId: training.id }
        );
      }
    }

    res.status(200).json(
      new ApiResponse(200, { training: populatedTraining }, `Training ${trainingId ? 'updated' : 'created'} successfully as ${training.status}`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new Training
 * @route   POST /api/trainings
 * @access  Private (Instructor, Admin)
 */
const createTraining = async (req, res, next) => {
  try {
    const { title, description, categoryId, departmentId, durationDays, isMandatory, thumbnailUrl, thumbnailPublicId, benefits } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const instructorId = String(req.user.id || req.user._id);

    if (!title || !description || !categoryId) {
      throw new ApiError(400, 'Please provide title, description, and categoryId');
    }

    const catId = String(categoryId);
    const category = await prisma.trainingCategory.findFirst({
      where: { id: catId, organizationId: orgId }
    });
    if (!category) {
      throw new ApiError(404, 'Training category not found');
    }

    let depId = null;
    if (departmentId) {
      depId = String(departmentId);
      const department = await prisma.department.findFirst({
        where: { id: depId, organizationId: orgId }
      });
      if (!department) {
        throw new ApiError(404, 'Department not found');
      }
    }

    const training = await prisma.training.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        benefits: Array.isArray(benefits) ? benefits : [],
        categoryId: catId,
        departmentId: depId,
        createdBy: instructorId,
        organizationId: orgId,
        durationDays: Number(durationDays) || 30,
        isMandatory: req.user.role === 'Admin' ? Boolean(isMandatory) : false,
        thumbnailUrl: thumbnailUrl || null,
        thumbnailPublicId: thumbnailPublicId || null
      }
    });

    const populatedTraining = await getPopulatedTraining(training.id);

    const { sendAdminNotification } = require('../services/notificationService');
    await sendAdminNotification(
      orgId,
      'NEW_TRAINING_CREATED',
      'New Training Created',
      `Instructor ${req.user.name || 'Instructor'} created a new training: ${title}.`,
      { entityType: 'Training', entityId: training.id }
    );

    res.status(201).json(new ApiResponse(201, { training: populatedTraining }, 'Training created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Trainings (Admin = all org, Instructor = owned, Employee = published)
 * @route   GET /api/trainings
 * @access  Private
 */
const getTrainings = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);

    const whereClause = {
      organizationId: orgId,
      status: { not: 'archived' }
    };

    if (req.user.role === 'Instructor') {
      whereClause.createdBy = userId;
    } else if (req.user.role === 'Employee') {
      whereClause.isPublished = true;
    }

    const trainingsList = await prisma.training.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        categoryId: true,
        departmentId: true,
        createdBy: true,
        organizationId: true,
        durationDays: true,
        isMandatory: true,
        isPublished: true,
        status: true,
        thumbnailUrl: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        instructor: { select: { id: true, name: true, email: true } },
        sections: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const trainings = trainingsList.map(t => {
      const transformed = withId(t);
      if (transformed.category) transformed.categoryId = transformed.category;
      if (transformed.department) transformed.departmentId = transformed.department;
      if (transformed.instructor) transformed.createdBy = transformed.instructor;
      return transformed;
    });

    res.status(200).json(new ApiResponse(200, { trainings }, 'Trainings retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Training Details by ID
 * @route   GET /api/trainings/:id
 * @access  Private
 */
const getTrainingById = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);

    const training = await getPopulatedTraining(trgId);

    if (!training || String(training.organizationId) !== orgId) {
      throw new ApiError(404, 'Training not found');
    }

    if (req.user.role === 'Instructor' && String(training.createdBy.id || training.createdBy._id || training.createdBy) !== userId) {
      throw new ApiError(403, 'You do not have permission to access this training');
    }

    res.status(200).json(new ApiResponse(200, { training }, 'Training details retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Basic Training Details
 * @route   PUT /api/trainings/:id
 * @access  Private (Instructor owner, Admin)
 */
const updateTraining = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);

    const existing = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });

    if (!existing) {
      throw new ApiError(404, 'Training not found');
    }

    if (req.user.role === 'Instructor' && existing.createdBy !== userId) {
      throw new ApiError(403, 'You are not authorized to update this training');
    }

    const { title, description, benefits, categoryId, departmentId, durationDays, isMandatory, isPublished, status, thumbnailUrl, thumbnailPublicId } = req.body;

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (benefits) updateData.benefits = Array.isArray(benefits) ? benefits : [];
    if (categoryId) updateData.categoryId = String(categoryId);
    if (departmentId !== undefined) updateData.departmentId = departmentId ? String(departmentId) : null;
    if (durationDays) updateData.durationDays = Number(durationDays);
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (thumbnailPublicId !== undefined) updateData.thumbnailPublicId = thumbnailPublicId;
    if (req.user.role === 'Admin' && isMandatory !== undefined) updateData.isMandatory = Boolean(isMandatory);
    if (isPublished !== undefined) {
      updateData.isPublished = Boolean(isPublished);
      if (!status) updateData.status = updateData.isPublished ? 'published' : 'draft';
    }
    if (status) {
      updateData.status = status;
      if (status === 'published' || status === 'draft') {
        updateData.isPublished = status === 'published';
      }
    }

    await prisma.training.update({
      where: { id: existing.id },
      data: updateData
    });

    const updatedTraining = await getPopulatedTraining(existing.id);

    const { sendUserNotification, sendAdminNotification } = require('../services/notificationService');
    if (existing.createdBy) {
      await sendUserNotification(
        existing.createdBy,
        orgId,
        'Instructor',
        'TRAINING_UPDATED',
        'Training Updated',
        `Training '${updatedTraining.title}' details updated.`,
        { entityType: 'Training', entityId: existing.id }
      );
    }

    const isNowPublished = updateData.isPublished === true || updateData.status === 'published';
    const wasPublished = existing.isPublished || existing.status === 'published';

    if (isNowPublished && !wasPublished) {
      await sendAdminNotification(
        orgId,
        'TRAINING_PUBLISHED',
        'Training Published',
        `Training '${updatedTraining.title}' is now published.`,
        { entityType: 'Training', entityId: existing.id }
      );
      if (existing.createdBy) {
        await sendUserNotification(
          existing.createdBy,
          orgId,
          'Instructor',
          'TRAINING_PUBLISHED',
          'Training Published',
          `Your training '${updatedTraining.title}' is now published.`,
          { entityType: 'Training', entityId: existing.id }
        );
      }
    }

    res.status(200).json(new ApiResponse(200, { training: updatedTraining }, 'Training updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete/Archive Training
 * @route   DELETE /api/trainings/:id
 * @access  Private (Instructor owner, Admin)
 */
const deleteTraining = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);

    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });

    if (!training) {
      throw new ApiError(404, 'Training not found');
    }

    if (req.user.role === 'Instructor' && training.createdBy !== userId) {
      throw new ApiError(403, 'You are not authorized to delete this training');
    }

    await prisma.training.update({
      where: { id: training.id },
      data: {
        status: 'archived',
        isPublished: false
      }
    });

    // Automatically deactivate any active auto-assignment rules associated with this training
    await prisma.autoAssignmentRule.updateMany({
      where: { trainingId: training.id, status: 'active' },
      data: { status: 'inactive' }
    });

    const { sendUserNotification, sendAdminNotification } = require('../services/notificationService');
    await sendAdminNotification(
      orgId,
      'TRAINING_DELETED',
      'Training Deleted',
      `Training '${training.title}' has been deleted/archived.`,
      { entityType: 'Training', entityId: training.id }
    );
    if (training.createdBy) {
      await sendUserNotification(
        training.createdBy,
        orgId,
        'Instructor',
        'TRAINING_DELETED',
        'Training Deleted',
        `Training '${training.title}' has been deleted.`,
        { entityType: 'Training', entityId: training.id }
      );
    }

    res.status(200).json(new ApiResponse(200, {}, 'Training archived successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add Section to Training
 * @route   POST /api/trainings/:id/sections
 * @access  Private (Instructor owner, Admin)
 */
const addSection = async (req, res, next) => {
  try {
    const { title, description, order } = req.body;
    if (!title) throw new ApiError(400, 'Section title is required');

    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);

    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) throw new ApiError(404, 'Training not found');

    if (req.user.role === 'Instructor' && training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    const currentCount = await prisma.trainingSection.count({
      where: { trainingId: training.id }
    });

    await prisma.trainingSection.create({
      data: {
        trainingId: training.id,
        title: title.trim(),
        description: description || '',
        order: order || currentCount + 1
      }
    });

    const updatedTraining = await getPopulatedTraining(training.id);

    res.status(201).json(new ApiResponse(201, { training: updatedTraining }, 'Section added successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Section
 * @route   PUT /api/trainings/:id/sections/:sectionId
 * @access  Private (Instructor owner, Admin)
 */
const updateSection = async (req, res, next) => {
  try {
    const { title, description, order } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);
    const secId = String(req.params.sectionId);

    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) throw new ApiError(404, 'Training not found');

    if (req.user.role === 'Instructor' && training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    const section = await prisma.trainingSection.findFirst({
      where: { id: secId, trainingId: training.id }
    });
    if (!section) throw new ApiError(404, 'Section not found');

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = Number(order);

    await prisma.trainingSection.update({
      where: { id: section.id },
      data: updateData
    });

    const updatedTraining = await getPopulatedTraining(training.id);

    res.status(200).json(new ApiResponse(200, { training: updatedTraining }, 'Section updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Section
 * @route   DELETE /api/trainings/:id/sections/:sectionId
 * @access  Private (Instructor owner, Admin)
 */
const deleteSection = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);
    const secId = String(req.params.sectionId);

    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) throw new ApiError(404, 'Training not found');

    if (req.user.role === 'Instructor' && training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    await prisma.trainingSection.deleteMany({
      where: { id: secId, trainingId: training.id }
    });

    const updatedTraining = await getPopulatedTraining(training.id);

    res.status(200).json(new ApiResponse(200, { training: updatedTraining }, 'Section deleted successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add SubSection to Section
 * @route   POST /api/trainings/:id/sections/:sectionId/subsections
 * @access  Private (Instructor owner, Admin)
 */
const addSubSection = async (req, res, next) => {
  try {
    const { title, description, order, videoUrl, videoPublicId, videoDuration } = req.body;
    if (!title) throw new ApiError(400, 'SubSection title is required');

    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);
    const secId = String(req.params.sectionId);

    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) throw new ApiError(404, 'Training not found');

    if (req.user.role === 'Instructor' && training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    const section = await prisma.trainingSection.findFirst({
      where: { id: secId, trainingId: training.id }
    });
    if (!section) throw new ApiError(404, 'Section not found');

    const currentCount = await prisma.trainingSubSection.count({
      where: { sectionId: section.id }
    });

    await prisma.trainingSubSection.create({
      data: {
        sectionId: section.id,
        title: title.trim(),
        description: description || '',
        order: order || currentCount + 1,
        videoUrl: videoUrl || '',
        videoPublicId: videoPublicId || '',
        videoDuration: Number(videoDuration) || 0,
        hasQuiz: false,
        hasAssignment: false
      }
    });

    const updatedTraining = await getPopulatedTraining(training.id);

    res.status(201).json(new ApiResponse(201, { training: updatedTraining }, 'Sub-section added successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update SubSection
 * @route   PUT /api/trainings/:id/sections/:sectionId/subsections/:subSectionId
 * @access  Private (Instructor owner, Admin)
 */
const updateSubSection = async (req, res, next) => {
  try {
    const { title, description, order, videoUrl, videoPublicId, videoDuration, pdfResources, hasQuiz, quizId, hasAssignment, assignmentId } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);
    const secId = String(req.params.sectionId);
    const subSecId = String(req.params.subSectionId);

    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) throw new ApiError(404, 'Training not found');

    if (req.user.role === 'Instructor' && training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    const section = await prisma.trainingSection.findFirst({
      where: { id: secId, trainingId: training.id }
    });
    if (!section) throw new ApiError(404, 'Section not found');

    const subSection = await prisma.trainingSubSection.findFirst({
      where: { id: subSecId, sectionId: section.id }
    });
    if (!subSection) throw new ApiError(404, 'Sub-section not found');

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = Number(order);
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (videoPublicId !== undefined) updateData.videoPublicId = videoPublicId;
    if (videoDuration !== undefined) updateData.videoDuration = Number(videoDuration);
    if (hasQuiz !== undefined) updateData.hasQuiz = Boolean(hasQuiz);
    if (quizId !== undefined) updateData.quizId = quizId ? String(quizId) : null;
    if (hasAssignment !== undefined) updateData.hasAssignment = Boolean(hasAssignment);
    if (assignmentId !== undefined) updateData.assignmentId = assignmentId ? String(assignmentId) : null;

    await prisma.trainingSubSection.update({
      where: { id: subSection.id },
      data: updateData
    });

    if (pdfResources !== undefined && Array.isArray(pdfResources)) {
      await prisma.pdfResource.deleteMany({
        where: { subSectionId: subSection.id }
      });
      for (const r of pdfResources) {
        await prisma.pdfResource.create({
          data: {
            subSectionId: subSection.id,
            title: r.title || r.name || r.originalName || 'Resource PDF',
            pdfUrl: r.pdfUrl || r.fileUrl || r.url || '',
            pdfPublicId: r.pdfPublicId || r.filePublicId || r.publicId || '',
            originalName: r.originalName || r.name || r.title || 'Resource PDF'
          }
        });
      }
    }

    const updatedTraining = await getPopulatedTraining(training.id);

    res.status(200).json(new ApiResponse(200, { training: updatedTraining }, 'Sub-section updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete SubSection
 * @route   DELETE /api/trainings/:id/sections/:sectionId/subsections/:subSectionId
 * @access  Private (Instructor owner, Admin)
 */
const deleteSubSection = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const trgId = String(req.params.id);
    const secId = String(req.params.sectionId);
    const subSecId = String(req.params.subSectionId);

    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) throw new ApiError(404, 'Training not found');

    if (req.user.role === 'Instructor' && training.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    const section = await prisma.trainingSection.findFirst({
      where: { id: secId, trainingId: training.id }
    });
    if (!section) throw new ApiError(404, 'Section not found');

    await prisma.trainingSubSection.deleteMany({
      where: { id: subSecId, sectionId: section.id }
    });

    const updatedTraining = await getPopulatedTraining(training.id);

    res.status(200).json(new ApiResponse(200, { training: updatedTraining }, 'Sub-section deleted successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  saveFullCourse,
  createTraining,
  getTrainings,
  getTrainingById,
  updateTraining,
  deleteTraining,
  addSection,
  updateSection,
  deleteSection,
  addSubSection,
  updateSubSection,
  deleteSubSection
};
