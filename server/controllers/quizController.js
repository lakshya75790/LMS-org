const { prisma, withId } = require('../config/prismaClient');
const { updateOverallProgress } = require('../services/progressService');
const { logAuditAction } = require('../services/auditLogService');
const { sendAdminNotification } = require('../services/notificationService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Helper to fetch a populated quiz record matching Mongoose structure
 */
const getPopulatedQuiz = async (quizId) => {
  const qId = String(quizId);
  const quiz = await prisma.quiz.findUnique({
    where: { id: qId },
    include: {
      questions: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!quiz) return null;
  return withId(quiz);
};

/**
 * Helper to fetch a populated quiz attempt record matching Mongoose structure
 */
const getPopulatedQuizAttempt = async (attemptId) => {
  const aId = String(attemptId);
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: aId },
    include: {
      answers: {
        orderBy: { questionIndex: 'asc' }
      }
    }
  });

  if (!attempt) return null;
  return withId(attempt);
};

/**
 * Helper to normalize question objects for storage in Prisma
 */
const mapQuestionData = (q) => {
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
    // MCQ
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
};

/**
 * @desc    Create Quiz for a SubSection
 * @route   POST /api/quizzes
 * @access  Private (Instructor, Admin)
 */
const createQuiz = async (req, res, next) => {
  try {
    const { title, trainingId, sectionId, subSectionId, questions, timeLimitMinutes, passingScorePercent } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const instructorId = String(req.user.id || req.user._id);

    if (!title || !trainingId || !questions || !questions.length) {
      throw new ApiError(400, 'Please provide title, trainingId, and questions');
    }

    const trgId = String(trainingId);
    const training = await prisma.training.findFirst({
      where: { id: trgId, organizationId: orgId }
    });
    if (!training) {
      throw new ApiError(404, 'Training not found');
    }

    if (req.user.role === 'Instructor' && training.createdBy !== instructorId) {
      throw new ApiError(403, 'Not authorized to add quiz to this training');
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

    const quiz = await prisma.quiz.create({
      data: {
        title: title.trim(),
        trainingId: training.id,
        subSectionId: targetSubSectionId || training.id,
        timeLimitMinutes: Number(timeLimitMinutes) || 15,
        passingScorePercent: Number(passingScorePercent) || 70,
        createdBy: instructorId,
        organizationId: orgId,
        questions: {
          create: questions.map(q => mapQuestionData(q))
        }
      }
    });

    if (targetSubSectionId) {
      await prisma.trainingSubSection.update({
        where: { id: targetSubSectionId },
        data: {
          hasQuiz: true,
          quizId: quiz.id
        }
      });
    }

    const populatedQuiz = await getPopulatedQuiz(quiz.id);

    res.status(201).json(new ApiResponse(201, { quiz: populatedQuiz }, 'Quiz created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Quiz by ID (or by SubSection/Training ID, Masks correct answers for Employees)
 * @route   GET /api/quizzes/:id
 * @access  Private
 */
const getQuizById = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const paramId = String(req.params.id);

    let quiz = await prisma.quiz.findFirst({
      where: { id: paramId, organizationId: orgId },
      include: { questions: { orderBy: { createdAt: 'asc' } } }
    });

    if (!quiz) {
      quiz = await prisma.quiz.findFirst({
        where: { subSectionId: paramId, organizationId: orgId },
        include: { questions: { orderBy: { createdAt: 'asc' } } }
      });
    }
    if (!quiz) {
      quiz = await prisma.quiz.findFirst({
        where: { trainingId: paramId, organizationId: orgId },
        include: { questions: { orderBy: { createdAt: 'asc' } } }
      });
    }

    if (!quiz) {
      throw new ApiError(404, 'Quiz not found');
    }

    const quizObj = withId(quiz);

    // Mask correct answers if employee is attempting the quiz
    if (req.user.role === 'Employee') {
      quizObj.questions = quizObj.questions.map(q => {
        const { correctAnswerIndex, correctAnswerText, ...rest } = q;
        return rest;
      });
    }

    res.status(200).json(new ApiResponse(200, { quiz: quizObj }, 'Quiz retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Start Quiz Attempt & Track Start Time
 * @route   POST /api/quizzes/:id/start
 * @access  Private (Employee)
 */
const startQuiz = async (req, res, next) => {
  try {
    const { trainingAssignmentId } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const paramId = String(req.params.id);

    let quiz = await prisma.quiz.findFirst({
      where: { id: paramId, organizationId: orgId }
    });
    if (!quiz) {
      quiz = await prisma.quiz.findFirst({
        where: { subSectionId: paramId, organizationId: orgId }
      });
    }
    if (!quiz) {
      quiz = await prisma.quiz.findFirst({
        where: { trainingId: paramId, organizationId: orgId }
      });
    }

    if (!quiz) {
      throw new ApiError(404, 'Quiz not found');
    }

    // Search for active in_progress attempt
    let attempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId: quiz.id,
        employeeId: userId,
        status: 'in_progress'
      },
      include: { answers: true }
    });

    const now = Date.now();
    const limitMs = (quiz.timeLimitMinutes || 15) * 60 * 1000;

    if (attempt) {
      const startTime = new Date(attempt.startTime).getTime();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const remainingSeconds = Math.max(0, Math.floor((limitMs / 1000) - elapsedSeconds));

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            attempt: withId(attempt),
            startTime: attempt.startTime,
            timeLimitMinutes: quiz.timeLimitMinutes,
            remainingSeconds
          },
          'Quiz attempt in progress'
        )
      );
    }

    // Create new in_progress attempt
    const previousAttemptsCount = await prisma.quizAttempt.count({
      where: {
        quizId: quiz.id,
        employeeId: userId,
        status: 'completed'
      }
    });

    attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        trainingAssignmentId: trainingAssignmentId ? String(trainingAssignmentId) : null,
        employeeId: userId,
        status: 'in_progress',
        startTime: new Date(now),
        attemptNumber: previousAttemptsCount + 1
      },
      include: { answers: true }
    });

    res.status(201).json(
      new ApiResponse(
        201,
        {
          attempt: withId(attempt),
          startTime: attempt.startTime,
          timeLimitMinutes: quiz.timeLimitMinutes,
          remainingSeconds: Math.floor(limitMs / 1000)
        },
        'Quiz attempt started'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Quiz
 * @route   PUT /api/quizzes/:id
 * @access  Private (Instructor owner, Admin)
 */
const updateQuiz = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const qId = String(req.params.id);

    const quiz = await prisma.quiz.findFirst({
      where: { id: qId, organizationId: orgId }
    });
    if (!quiz) {
      throw new ApiError(404, 'Quiz not found');
    }

    if (req.user.role === 'Instructor' && quiz.createdBy !== userId) {
      throw new ApiError(403, 'Not authorized to update this quiz');
    }

    const { title, questions, timeLimitMinutes, passingScorePercent } = req.body;

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (timeLimitMinutes) updateData.timeLimitMinutes = Number(timeLimitMinutes);
    if (passingScorePercent) updateData.passingScorePercent = Number(passingScorePercent);

    await prisma.quiz.update({
      where: { id: quiz.id },
      data: updateData
    });

    if (questions && Array.isArray(questions)) {
      await prisma.quizQuestion.deleteMany({
        where: { quizId: quiz.id }
      });

      await prisma.quizQuestion.createMany({
        data: questions.map(q => ({
          quizId: quiz.id,
          ...mapQuestionData(q)
        }))
      });
    }

    const updatedQuiz = await getPopulatedQuiz(quiz.id);

    res.status(200).json(new ApiResponse(200, { quiz: updatedQuiz }, 'Quiz updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit Quiz Answers & Calculate Result (Idempotent & Safe for Timeouts)
 * @route   POST /api/quizzes/:id/submit
 * @access  Private (Employee)
 */
const submitQuiz = async (req, res, next) => {
  try {
    const userAnswers = req.body.userAnswers || req.body.answers;
    const { trainingAssignmentId, attemptId } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const paramId = String(req.params.id);

    if (!userAnswers || !Array.isArray(userAnswers)) {
      throw new ApiError(400, 'Please provide userAnswers array');
    }

    let quiz = await prisma.quiz.findFirst({
      where: { id: paramId, organizationId: orgId },
      include: { questions: { orderBy: { createdAt: 'asc' } } }
    });
    if (!quiz) {
      quiz = await prisma.quiz.findFirst({
        where: { subSectionId: paramId, organizationId: orgId },
        include: { questions: { orderBy: { createdAt: 'asc' } } }
      });
    }
    if (!quiz) {
      quiz = await prisma.quiz.findFirst({
        where: { trainingId: paramId, organizationId: orgId },
        include: { questions: { orderBy: { createdAt: 'asc' } } }
      });
    }

    if (!quiz) {
      throw new ApiError(404, 'Quiz not found');
    }

    // Check for existing attempt
    let attempt;
    if (attemptId) {
      attempt = await prisma.quizAttempt.findFirst({
        where: { id: String(attemptId), employeeId: userId },
        include: { answers: true }
      });
    }
    if (!attempt) {
      attempt = await prisma.quizAttempt.findFirst({
        where: {
          quizId: quiz.id,
          employeeId: userId,
          status: 'in_progress'
        },
        include: { answers: true }
      });
    }

    // Idempotency check: if attempt is already completed, return existing result without error
    if (attempt && attempt.status === 'completed') {
      const populatedAttempt = await getPopulatedQuizAttempt(attempt.id);
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            attempt: populatedAttempt,
            passingScorePercent: quiz.passingScorePercent,
            percentage: attempt.percentage,
            passed: attempt.passed,
            evaluatedAnswers: populatedAttempt.answers
          },
          attempt.passed ? 'Congratulations! You passed the quiz.' : `Quiz failed (${attempt.percentage}%). Required score: ${quiz.passingScorePercent}%.`
        )
      );
    }

    let totalScore = 0;
    let maxScore = 0;
    const evaluatedAnswersData = [];

    quiz.questions.forEach((q, idx) => {
      const qScore = q.score || 1;
      maxScore += qScore;

      const userAns = userAnswers.find(a => a.questionIndex === idx || a.questionIdx === idx);

      const qType = q.questionType || (q.options && q.options.length > 0 ? 'MCQ' : 'FILL_IN_BLANK');

      let isCorrect = false;
      let selectedOptionIndex = null;
      let selectedAnswerText = '';
      let correctAnswerIndex = q.correctAnswerIndex;
      let correctAnswerText = q.correctAnswerText || '';

      if (qType === 'TRUE_FALSE') {
        const rawOpt = userAns
          ? (userAns.selectedOptionIndex !== undefined && userAns.selectedOptionIndex !== null
            ? userAns.selectedOptionIndex
            : userAns.selectedOptionIdx)
          : null;

        selectedOptionIndex = rawOpt !== null && rawOpt !== undefined && !isNaN(Number(rawOpt))
          ? Number(rawOpt)
          : null;

        if (selectedOptionIndex !== null && selectedOptionIndex >= 0 && selectedOptionIndex <= 1) {
          selectedAnswerText = selectedOptionIndex === 0 ? 'True' : 'False';
        } else if (userAns && userAns.selectedAnswerText !== undefined && userAns.selectedAnswerText !== null) {
          const textVal = String(userAns.selectedAnswerText).trim().toLowerCase();
          if (textVal === 'true') {
            selectedOptionIndex = 0;
            selectedAnswerText = 'True';
          } else if (textVal === 'false') {
            selectedOptionIndex = 1;
            selectedAnswerText = 'False';
          } else {
            selectedAnswerText = String(userAns.selectedAnswerText).trim();
          }
        }

        correctAnswerIndex = q.correctAnswerIndex !== null && q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : 0;
        correctAnswerText = correctAnswerText || (correctAnswerIndex === 0 ? 'True' : 'False');

        isCorrect = selectedOptionIndex !== null && selectedOptionIndex === correctAnswerIndex;

      } else if (qType === 'FILL_IN_BLANK') {
        selectedAnswerText = userAns && userAns.selectedAnswerText !== undefined && userAns.selectedAnswerText !== null
          ? String(userAns.selectedAnswerText)
          : '';

        const normUser = selectedAnswerText.trim().toLowerCase();
        const normCorrect = (correctAnswerText || '').trim().toLowerCase();

        isCorrect = Boolean(normUser && normCorrect && normUser === normCorrect);
        selectedOptionIndex = null;
        correctAnswerIndex = null;

      } else {
        // MCQ
        const rawOpt = userAns
          ? (userAns.selectedOptionIndex !== undefined && userAns.selectedOptionIndex !== null
            ? userAns.selectedOptionIndex
            : userAns.selectedOptionIdx)
          : null;

        selectedOptionIndex = rawOpt !== null && rawOpt !== undefined && !isNaN(Number(rawOpt))
          ? Number(rawOpt)
          : null;

        const hasSelected = selectedOptionIndex !== null && selectedOptionIndex >= 0 && selectedOptionIndex < (q.options ? q.options.length : 0);
        selectedAnswerText = hasSelected ? (q.options[selectedOptionIndex] || '') : (userAns?.selectedAnswerText || '');
        correctAnswerText = correctAnswerText || (q.options && q.correctAnswerIndex !== null && q.correctAnswerIndex !== undefined ? q.options[q.correctAnswerIndex] : '');

        isCorrect = hasSelected && selectedOptionIndex === q.correctAnswerIndex;
      }

      if (isCorrect) {
        totalScore += qScore;
      }

      evaluatedAnswersData.push({
        questionIndex: idx,
        questionText: q.questionText || `Question ${idx + 1}`,
        questionType: qType,
        selectedOptionIndex,
        selectedAnswerText,
        correctAnswerIndex,
        correctAnswerText,
        options: q.options || [],
        isCorrect
      });
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = percentage >= quiz.passingScorePercent;

    if (attempt) {
      await prisma.quizAttemptAnswer.deleteMany({
        where: { quizAttemptId: attempt.id }
      });

      attempt = await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'completed',
          endTime: new Date(),
          submittedAt: new Date(),
          totalScore,
          maxScore,
          percentage,
          passed,
          answers: {
            create: evaluatedAnswersData
          }
        }
      });
    } else {
      const previousAttemptsCount = await prisma.quizAttempt.count({
        where: {
          quizId: quiz.id,
          employeeId: userId,
          status: 'completed'
        }
      });

      attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          trainingAssignmentId: trainingAssignmentId ? String(trainingAssignmentId) : null,
          employeeId: userId,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          submittedAt: new Date(),
          totalScore,
          maxScore,
          percentage,
          passed,
          attemptNumber: previousAttemptsCount + 1,
          answers: {
            create: evaluatedAnswersData
          }
        }
      });
    }

    let targetAssignmentId = trainingAssignmentId ? String(trainingAssignmentId) : null;
    if (!targetAssignmentId && quiz.trainingId) {
      const foundTa = await prisma.trainingAssignment.findFirst({
        where: { trainingId: quiz.trainingId, employeeId: userId }
      });
      if (foundTa) targetAssignmentId = foundTa.id;
    }

    if (targetAssignmentId && passed) {
      await updateOverallProgress(targetAssignmentId, userId);
    }

    // Send quiz result notification to employee & instructor
    const { sendUserNotification, sendInstructorNotification } = require('../services/notificationService');
    const empName = req.user.name || 'Employee';

    if (passed) {
      await sendUserNotification(
        userId,
        orgId,
        'Employee',
        'QUIZ_PASSED',
        'Quiz Passed',
        `Congratulations! You passed the quiz for ${quiz.title} with a score of ${percentage}%.`,
        { entityType: 'Quiz', entityId: quiz.id }
      );
      if (quiz.createdBy) {
        await sendInstructorNotification(
          quiz.createdBy,
          orgId,
          'QUIZ_PASSED',
          'Employee Passed Quiz',
          `Employee ${empName} passed quiz '${quiz.title}' with ${percentage}%.`,
          { entityType: 'Quiz', entityId: quiz.id }
        );
      }
    } else {
      await sendUserNotification(
        userId,
        orgId,
        'Employee',
        'QUIZ_FAILED',
        'Quiz Failed',
        `You did not pass the quiz for ${quiz.title}. Score: ${percentage}%.`,
        { entityType: 'Quiz', entityId: quiz.id }
      );
      if (quiz.createdBy) {
        await sendInstructorNotification(
          quiz.createdBy,
          orgId,
          'QUIZ_FAILED',
          'Employee Failed Quiz',
          `Employee ${empName} failed quiz '${quiz.title}' with ${percentage}%.`,
          { entityType: 'Quiz', entityId: quiz.id }
        );
      }
    }

    const populatedAttempt = await getPopulatedQuizAttempt(attempt.id);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          attempt: populatedAttempt,
          passingScorePercent: quiz.passingScorePercent,
          percentage,
          passed,
          evaluatedAnswers: populatedAttempt.answers
        },
        passed ? 'Congratulations! You passed the quiz.' : `Quiz failed (${percentage}%). Required score: ${quiz.passingScorePercent}%. Please retake.`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Quiz Attempts for Employee / Quiz
 * @route   GET /api/quizzes/:id/attempts
 * @access  Private
 */
const getQuizAttempts = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const paramId = String(req.params.id);

    let quiz = await prisma.quiz.findFirst({
      where: { id: paramId, organizationId: orgId }
    });
    if (!quiz) {
      quiz = await prisma.quiz.findFirst({
        where: { subSectionId: paramId, organizationId: orgId }
      });
    }

    const quizId = quiz ? quiz.id : paramId;

    const whereClause = { quizId };
    if (req.user.role === 'Employee') {
      whereClause.employeeId = userId;
    }

    const attemptsList = await prisma.quizAttempt.findMany({
      where: whereClause,
      select: { id: true },
      orderBy: { createdAt: 'desc' }
    });

    const attempts = await Promise.all(attemptsList.map(a => getPopulatedQuizAttempt(a.id)));

    res.status(200).json(new ApiResponse(200, { attempts }, 'Quiz attempts retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log a security violation event (Focus Mode)
 * @route   POST /api/quizzes/:id/security-event
 * @access  Private (Employee)
 */
const logSecurityEvent = async (req, res, next) => {
  try {
    const { eventType, details } = req.body;
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const userId = String(req.user.id || req.user._id);
    const quizId = String(req.params.id);

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, organizationId: orgId }
    });

    if (!quiz) {
      throw new ApiError(404, 'Quiz not found');
    }

    const employeeName = req.user.name || 'Employee';
    const title = 'Quiz Security Alert';
    const violationType = eventType === 'fullscreen_exit' ? 'exited Focus Mode/fullscreen during the quiz' : 'switched away from the quiz';
    const violationMessage = `Quiz Security Alert — ${employeeName} ${violationType}.`;

    // 1. Notify Org Admin
    await sendAdminNotification(
      orgId,
      'security_alert',
      title,
      violationMessage,
      { entityType: 'Quiz', entityId: quiz.id },
      { preventDuplicates: false }
    );

    // 2. Audit Log
    await logAuditAction(
      req.user,
      'quiz_security_violation',
      'Quiz',
      quiz.id,
      `Event: ${eventType}. Details: ${details || violationMessage}`
    );

    res.status(200).json(new ApiResponse(200, null, 'Security event logged successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuiz,
  getQuizById,
  startQuiz,
  updateQuiz,
  submitQuiz,
  getQuizAttempts,
  logSecurityEvent
};
