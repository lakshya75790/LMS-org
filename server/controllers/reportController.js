const { prisma, withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Comprehensive Organization Reports & Analytics Engine
 * @route   GET /api/reports/full-org-report
 * @access  Private (Organization Admin)
 */
const getFullOrgReport = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const now = new Date();

    const [
      totalInstructors,
      rawAssignmentsList,
      departmentsList,
      employeesList,
      trainingsList,
      activeAutoRulesList
    ] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'Instructor' } }),
      prisma.trainingAssignment.findMany({
        where: { organizationId: orgId },
        include: {
          employee: { select: { id: true, name: true, email: true, departmentId: true, jobRole: true, profilePicture: true, status: true } },
          training: {
            select: {
              id: true,
              title: true,
              categoryId: true,
              durationDays: true,
              isMandatory: true,
              category: { select: { id: true, name: true } }
            }
          },
          assigner: { select: { id: true, name: true, email: true, role: true } }
        }
      }),
      prisma.department.findMany({
        where: { organizationId: orgId, status: 'active' },
        orderBy: { name: 'asc' }
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'Employee' },
        include: { department: { select: { id: true, name: true, jobRoles: true } } }
      }),
      prisma.training.findMany({
        where: { organizationId: orgId, isPublished: true },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { title: 'asc' }
      }),
      prisma.autoAssignmentRule.findMany({
        where: {
          organizationId: orgId,
          status: 'active',
          training: { isPublished: true, status: 'published' }
        },
        include: {
          training: {
            select: {
              id: true,
              title: true,
              categoryId: true,
              durationDays: true,
              isMandatory: true,
              category: { select: { id: true, name: true } }
            }
          },
          creator: { select: { id: true, name: true, email: true } }
        }
      })
    ]);

    const totalEmployees = employeesList.length;
    const totalDepartments = departmentsList.length;
    const activeTrainingsCount = trainingsList.length;
    const mandatoryTrainingsList = trainingsList.filter(t => t.isMandatory);

    const allAssignments = rawAssignmentsList.map(a => {
      const transformed = withId(a);
      if (transformed.employee) transformed.employeeId = transformed.employee;
      if (transformed.training) {
        transformed.trainingId = transformed.training;
        if (transformed.training.category) transformed.trainingId.categoryId = transformed.training.category;
      }
      if (transformed.assigner) transformed.assignedBy = transformed.assigner;
      return transformed;
    });

    const totalAssignments = allAssignments.length;
    const completedAssignments = allAssignments.filter(a => a.status === 'Completed').length;
    const inProgressAssignments = allAssignments.filter(a => a.status === 'In Progress').length;
    const pendingAssignments = allAssignments.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
    const overdueAssignments = allAssignments.filter(a => a.status === 'Overdue').length;

    const overallComplianceRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    // Build fast lookup Hash Maps
    const assignsByEmp = new Map();
    const assignsByTraining = new Map();
    allAssignments.forEach(a => {
      if (a.employeeId && a.employeeId._id) {
        const empId = a.employeeId._id.toString();
        if (!assignsByEmp.has(empId)) assignsByEmp.set(empId, []);
        assignsByEmp.get(empId).push(a);
      }
      if (a.trainingId && a.trainingId._id) {
        const trgId = a.trainingId._id.toString();
        if (!assignsByTraining.has(trgId)) assignsByTraining.set(trgId, []);
        assignsByTraining.get(trgId).push(a);
      }
    });

    // 2. Department & Role Drill-Down Analytics
    const departments = withId(departmentsList);

    const employees = employeesList.map(e => {
      const transformed = withId(e);
      delete transformed.password;
      if (transformed.department) transformed.departmentId = transformed.department;
      return transformed;
    });

    const empByDept = new Map();
    employees.forEach(e => {
      const dId = typeof e.departmentId === 'object' ? e.departmentId?._id : e.departmentId;
      if (dId) {
        const key = dId.toString();
        if (!empByDept.has(key)) empByDept.set(key, []);
        empByDept.get(key).push(e);
      }
    });

    const departmentAnalytics = [];

    for (const dep of departments) {
      const depEmployees = empByDept.get(dep._id.toString()) || [];
      const depAssignments = [];
      depEmployees.forEach(e => {
        const empAssigns = assignsByEmp.get(e._id.toString()) || [];
        depAssignments.push(...empAssigns);
      });

      const depTotalAssigned = depAssignments.length;
      const depCompleted = depAssignments.filter(a => a.status === 'Completed').length;
      const depInProgress = depAssignments.filter(a => a.status === 'In Progress').length;
      const depPending = depAssignments.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
      const depOverdue = depAssignments.filter(a => a.status === 'Overdue').length;
      const depComplianceRate = depTotalAssigned > 0 ? Math.round((depCompleted / depTotalAssigned) * 100) : 0;

      const totalProgressSum = depAssignments.reduce((acc, a) => acc + (a.progressPercentage || 0), 0);
      const avgProgress = depTotalAssigned > 0 ? Math.round(totalProgressSum / depTotalAssigned) : 0;

      // Group by Job Roles within Department
      const allRolesInDept = Array.from(new Set([...(dep.jobRoles || []), ...depEmployees.map(e => e.jobRole).filter(Boolean)]));
      const roleAnalytics = allRolesInDept.map(roleName => {
        const roleEmployees = depEmployees.filter(e => e.jobRole === roleName);
        const roleAssignments = [];
        roleEmployees.forEach(e => {
          const empAssigns = assignsByEmp.get(e._id.toString()) || [];
          roleAssignments.push(...empAssigns);
        });

        const rTotal = roleAssignments.length;
        const rComp = roleAssignments.filter(a => a.status === 'Completed').length;
        const rInProg = roleAssignments.filter(a => a.status === 'In Progress').length;
        const rPend = roleAssignments.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
        const rOverdue = roleAssignments.filter(a => a.status === 'Overdue').length;
        const rCompliance = rTotal > 0 ? Math.round((rComp / rTotal) * 100) : 0;

        return {
          jobRole: roleName,
          totalEmployees: roleEmployees.length,
          totalAssigned: rTotal,
          completed: rComp,
          inProgress: rInProg,
          pending: rPend,
          overdue: rOverdue,
          complianceRate: rCompliance,
          employees: roleEmployees.map(emp => {
            const empAssigns = assignsByEmp.get(emp._id.toString()) || [];
            const eComp = empAssigns.filter(a => a.status === 'Completed').length;
            const eTotal = empAssigns.length;
            const eAvgProgress = eTotal > 0 ? Math.round(empAssigns.reduce((acc, a) => acc + (a.progressPercentage || 0), 0) / eTotal) : 0;
            return {
              _id: emp._id,
              name: emp.name,
              email: emp.email,
              profilePicture: emp.profilePicture,
              totalAssigned: eTotal,
              completed: eComp,
              inProgress: empAssigns.filter(a => a.status === 'In Progress').length,
              pending: empAssigns.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length,
              overdue: empAssigns.filter(a => a.status === 'Overdue').length,
              overallProgress: eAvgProgress,
              complianceStatus: eTotal > 0 && eComp === eTotal ? 'Fully Compliant' : empAssigns.some(a => a.status === 'Overdue') ? 'At Risk' : 'In Progress'
            };
          })
        };
      });

      departmentAnalytics.push({
        departmentId: dep._id,
        departmentName: dep.name,
        totalEmployees: depEmployees.length,
        totalRoles: allRolesInDept.length,
        totalAssigned: depTotalAssigned,
        completed: depCompleted,
        inProgress: depInProgress,
        pending: depPending,
        overdue: depOverdue,
        complianceRate: depComplianceRate,
        avgEmployeeProgress: avgProgress,
        roles: roleAnalytics
      });
    }

    // 3. Employee Progress Table Analytics
    const employeeAnalytics = employees.map(emp => {
      const empAssigns = assignsByEmp.get(emp._id.toString()) || [];
      const eTotal = empAssigns.length;
      const eComp = empAssigns.filter(a => a.status === 'Completed').length;
      const eInProg = empAssigns.filter(a => a.status === 'In Progress').length;
      const ePend = empAssigns.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
      const eOverdue = empAssigns.filter(a => a.status === 'Overdue').length;
      const eAvgProgress = eTotal > 0 ? Math.round(empAssigns.reduce((acc, a) => acc + (a.progressPercentage || 0), 0) / eTotal) : 0;

      return {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        profilePicture: emp.profilePicture,
        departmentId: emp.departmentId?._id,
        departmentName: emp.departmentId?.name || 'Unassigned',
        jobRole: emp.jobRole || 'Unassigned',
        totalAssigned: eTotal,
        completed: eComp,
        inProgress: eInProg,
        pending: ePend,
        overdue: eOverdue,
        complianceRate: eTotal > 0 ? Math.round((eComp / eTotal) * 100) : 0,
        overallProgress: eAvgProgress,
        complianceStatus: eTotal > 0 && eComp === eTotal ? 'Fully Compliant' : eOverdue > 0 ? 'At Risk' : eInProg > 0 ? 'In Progress' : 'Pending',
        assignments: empAssigns.map(a => ({
          assignmentId: a._id,
          trainingTitle: a.trainingId?.title || 'Training',
          categoryName: a.trainingId?.categoryId?.name || 'General',
          isMandatory: a.trainingId?.isMandatory || a.assignmentType === 'auto',
          progressPercentage: a.progressPercentage || 0,
          status: a.status,
          assignedDate: a.assignedDate || a.createdAt,
          deadline: a.deadline,
          completedDate: a.completedDate
        }))
      };
    });

    // 4. Training-Wise Report
    const trainings = trainingsList.map(t => {
      const transformed = withId(t);
      if (transformed.category) transformed.categoryId = transformed.category;
      return transformed;
    });

    const trainingAnalytics = trainings.map(t => {
      const tAssigns = assignsByTraining.get(t._id.toString()) || [];
      const tTotal = tAssigns.length;
      const tComp = tAssigns.filter(a => a.status === 'Completed').length;
      const tInProg = tAssigns.filter(a => a.status === 'In Progress').length;
      const tPend = tAssigns.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
      const tOverdue = tAssigns.filter(a => a.status === 'Overdue').length;
      const tCompRate = tTotal > 0 ? Math.round((tComp / tTotal) * 100) : 0;
      const tAvgProgress = tTotal > 0 ? Math.round(tAssigns.reduce((acc, a) => acc + (a.progressPercentage || 0), 0) / tTotal) : 0;

      return {
        _id: t._id,
        title: t.title,
        categoryName: t.categoryId?.name || 'General',
        durationDays: t.durationDays,
        isMandatory: t.isMandatory,
        totalAssigned: tTotal,
        completed: tComp,
        inProgress: tInProg,
        pending: tPend,
        overdue: tOverdue,
        completionRate: tCompRate,
        avgProgress: tAvgProgress,
        enrolledEmployees: tAssigns.map(a => ({
          assignmentId: a._id,
          employeeId: a.employeeId?._id,
          employeeName: a.employeeId?.name || 'Unknown',
          employeeEmail: a.employeeId?.email || '',
          profilePicture: a.employeeId?.profilePicture,
          departmentName: a.employeeId?.departmentId?.name || 'Unassigned',
          jobRole: a.employeeId?.jobRole || 'Unassigned',
          progressPercentage: a.progressPercentage || 0,
          status: a.status,
          assignedDate: a.assignedDate || a.createdAt,
          deadline: a.deadline,
          completedDate: a.completedDate
        }))
      };
    });

    // 5. Overdue Trainings Report
    const overdueReport = allAssignments
      .filter(a => a.status === 'Overdue' || (new Date(a.deadline) < now && a.status !== 'Completed'))
      .map(a => {
        const deadlineDate = new Date(a.deadline);
        const daysOverdue = Math.max(1, Math.floor((now - deadlineDate) / (1000 * 60 * 60 * 24)));
        return {
          assignmentId: a._id,
          employeeName: a.employeeId?.name || 'Unknown',
          employeeEmail: a.employeeId?.email || '',
          departmentName: a.employeeId?.departmentId?.name || 'Unassigned',
          jobRole: a.employeeId?.jobRole || 'Unassigned',
          trainingTitle: a.trainingId?.title || 'Training',
          deadline: a.deadline,
          daysOverdue,
          currentProgress: a.progressPercentage || 0,
          assignedBy: a.assignedBy?.name || 'System Auto'
        };
      });

    // 6. Mandatory & Auto-Assigned Training Rules Report
    const activeAutoRules = activeAutoRulesList.map(r => {
      const transformed = withId(r);
      if (transformed.training) {
        transformed.trainingId = transformed.training;
        if (transformed.training.category) transformed.trainingId.categoryId = transformed.training.category;
      }
      if (transformed.creator) transformed.createdBy = transformed.creator;
      return transformed;
    });

    const mandatoryTrainings = mandatoryTrainingsList.map(t => {
      const transformed = withId(t);
      if (transformed.category) transformed.categoryId = transformed.category;
      return transformed;
    });

    const ruleTrainingMap = new Map();

    for (const rule of activeAutoRules) {
      if (rule.trainingId) {
        ruleTrainingMap.set(rule.trainingId._id.toString(), {
          ruleId: rule._id,
          trainingId: rule.trainingId._id,
          trainingTitle: rule.trainingId.title,
          categoryName: rule.trainingId.categoryId?.name || 'General',
          customDeadlineDays: rule.customDeadlineDays,
          createdBy: rule.createdBy?.name || 'Admin',
          isAutoRule: true
        });
      }
    }

    for (const t of mandatoryTrainings) {
      if (!ruleTrainingMap.has(t._id.toString())) {
        ruleTrainingMap.set(t._id.toString(), {
          ruleId: null,
          trainingId: t._id,
          trainingTitle: t.title,
          categoryName: t.categoryId?.name || 'General',
          customDeadlineDays: t.durationDays || 30,
          createdBy: 'Admin',
          isAutoRule: false
        });
      }
    }

    const mandatoryAnalytics = Array.from(ruleTrainingMap.values()).map(ruleInfo => {
      const tAssigns = allAssignments.filter(a => a.trainingId && a.trainingId._id.toString() === ruleInfo.trainingId.toString());
      const tTotal = tAssigns.length;
      const tComp = tAssigns.filter(a => a.status === 'Completed').length;
      const tInProg = tAssigns.filter(a => a.status === 'In Progress').length;
      const tPend = tAssigns.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
      const tOverdue = tAssigns.filter(a => a.status === 'Overdue').length;
      const tCompRate = tTotal > 0 ? Math.round((tComp / tTotal) * 100) : 0;

      return {
        ...ruleInfo,
        totalEmployees: totalEmployees,
        totalAssigned: tTotal,
        completed: tComp,
        inProgress: tInProg,
        pending: tPend,
        overdue: tOverdue,
        complianceRate: tCompRate,
        enrolledEmployees: tAssigns.map(a => ({
          assignmentId: a._id,
          employeeId: a.employeeId?._id,
          employeeName: a.employeeId?.name || 'Unknown',
          employeeEmail: a.employeeId?.email || '',
          profilePicture: a.employeeId?.profilePicture,
          departmentName: a.employeeId?.departmentId?.name || 'Unassigned',
          jobRole: a.employeeId?.jobRole || 'Unassigned',
          progressPercentage: a.progressPercentage || 0,
          status: a.status,
          assignedDate: a.assignedDate || a.createdAt,
          deadline: a.deadline,
          completedDate: a.completedDate
        }))
      };
    });

    // 7. Department Compliance Rankings Leaderboard
    const complianceLeaderboard = [...departmentAnalytics]
      .sort((a, b) => b.complianceRate - a.complianceRate)
      .map(d => ({
        departmentId: d.departmentId,
        departmentName: d.departmentName,
        complianceRate: d.complianceRate,
        totalEmployees: d.totalEmployees,
        totalAssigned: d.totalAssigned,
        completed: d.completed,
        inProgress: d.inProgress,
        pending: d.pending,
        overdue: d.overdue,
        status: d.totalAssigned === 0 ? 'No Assignments' : d.complianceRate === 100 ? 'Fully Compliant' : d.complianceRate >= 50 ? 'Needs Attention' : 'At Risk'
      }));

    res.status(200).json(
      new ApiResponse(
        200,
        {
          overview: {
            totalEmployees,
            totalInstructors,
            totalDepartments,
            totalActiveTrainings: activeTrainingsCount,
            totalAssignments,
            completedAssignments,
            inProgressAssignments,
            pendingAssignments,
            overdueAssignments,
            overallComplianceRate
          },
          departmentAnalytics,
          employeeAnalytics,
          trainingAnalytics,
          overdueReport,
          mandatoryAnalytics,
          complianceLeaderboard
        },
        'Full organization reports & analytics retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

const { getOrgLicenseStats } = require('../services/licenseService');

/**
 * @desc    Organization Admin Dashboard Analytics & Department Performance
 * @route   GET /api/reports/admin-dashboard
 * @access  Private (Organization Admin)
 */
const getAdminDashboardReports = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);

    const [
      totalInstructors,
      activeTrainingsCount,
      departments,
      allEmployees,
      allAssignments,
      logsList,
      licenseStats
    ] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'Instructor', status: 'active' } }),
      prisma.training.count({ where: { organizationId: orgId, isPublished: true, status: 'published' } }),
      prisma.department.findMany({ where: { organizationId: orgId, status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.user.findMany({ where: { organizationId: orgId, role: 'Employee', status: 'active' }, select: { id: true, departmentId: true } }),
      prisma.trainingAssignment.findMany({ where: { organizationId: orgId }, select: { id: true, employeeId: true, status: true, progressPercentage: true } }),
      prisma.auditLog.findMany({ where: { organizationId: orgId }, select: { id: true, action: true, details: true, userName: true, userRole: true, timestamp: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      getOrgLicenseStats(orgId)
    ]);

    const totalEmployees = allEmployees.length;

    const totalAssignmentsCount = allAssignments.length;
    const completedAssignmentsCount = allAssignments.filter(a => a.status === 'Completed').length;
    const inProgressAssignmentsCount = allAssignments.filter(a => a.status === 'In Progress').length;
    const overdueAssignmentsCount = allAssignments.filter(a => a.status === 'Overdue').length;

    // Map employees by department
    const empByDept = new Map();
    allEmployees.forEach(e => {
      if (e.departmentId) {
        if (!empByDept.has(e.departmentId)) empByDept.set(e.departmentId, new Set());
        empByDept.get(e.departmentId).add(e.id);
      }
    });

    // Map assignments by employeeId
    const assignsByEmp = new Map();
    allAssignments.forEach(a => {
      if (a.employeeId) {
        if (!assignsByEmp.has(a.employeeId)) assignsByEmp.set(a.employeeId, []);
        assignsByEmp.get(a.employeeId).push(a);
      }
    });

    const departmentPerformance = departments.map(dep => {
      const empIds = empByDept.get(dep.id) || new Set();
      const depAssignments = [];
      empIds.forEach(empId => {
        const empAssigns = assignsByEmp.get(empId) || [];
        depAssignments.push(...empAssigns);
      });

      const depTotal = depAssignments.length;
      const depCompleted = depAssignments.filter(a => a.status === 'Completed').length;
      const depInProgress = depAssignments.filter(a => a.status === 'In Progress').length;
      const depPending = depAssignments.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
      const depOverdue = depAssignments.filter(a => a.status === 'Overdue').length;

      const rawRate = depTotal > 0 ? Math.round((depCompleted / depTotal) * 100) : 0;

      return {
        departmentId: dep.id,
        departmentName: dep.name,
        totalEmployees: empIds.size,
        totalAssigned: depTotal,
        totalAssignments: depTotal,
        completed: depCompleted,
        completedAssignments: depCompleted,
        pending: depPending,
        inProgress: depInProgress,
        overdue: depOverdue,
        completionRate: `${rawRate}%`,
        completionPercentage: rawRate
      };
    });

    const recentLogs = withId(logsList);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          quickStats: {
            totalEmployees,
            totalInstructors,
            activeTrainings: activeTrainingsCount,
            totalAssignments: totalAssignmentsCount,
            completedTrainings: completedAssignmentsCount,
            inProgressTrainings: inProgressAssignmentsCount,
            overdueTrainings: overdueAssignmentsCount,
            overallCompletionRate: totalAssignmentsCount > 0 ? `${Math.round((completedAssignmentsCount / totalAssignmentsCount) * 100)}%` : '0%',
            totalLicenses: licenseStats.totalLicenses,
            usedLicenses: licenseStats.usedLicenses,
            remainingLicenses: licenseStats.remainingLicenses
          },
          licenseStats,
          departmentPerformance,
          departmentCompletion: departmentPerformance,
          recentLogs
        },
        'Admin dashboard analytics retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Detailed Employee Training Report (Admin View)
 * @route   GET /api/reports/employee/:employeeId
 * @access  Private (Admin, Instructor)
 */
const getEmployeeReport = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const empParamId = String(req.params.employeeId);

    const [employeeRecord, assignmentsList] = await Promise.all([
      prisma.user.findFirst({
        where: { id: empParamId, organizationId: orgId },
        include: { department: { select: { id: true, name: true } } }
      }),
      prisma.trainingAssignment.findMany({
        where: { employeeId: empParamId, organizationId: orgId },
        include: { training: { select: { id: true, title: true, categoryId: true, durationDays: true } } },
        orderBy: { assignedDate: 'desc' }
      })
    ]);

    if (!employeeRecord) {
      throw new ApiError(404, 'Employee not found');
    }

    const employee = withId(employeeRecord);
    delete employee.password;
    if (employee.department) employee.departmentId = employee.department;

    const assignments = assignmentsList.map(a => {
      const transformed = withId(a);
      if (transformed.training) transformed.trainingId = transformed.training;
      return transformed;
    });

    const totalAssigned = assignments.length;
    const completed = assignments.filter(a => a.status === 'Completed').length;
    const inProgress = assignments.filter(a => a.status === 'In Progress').length;
    const overdue = assignments.filter(a => a.status === 'Overdue').length;
    const locked = assignments.filter(a => a.status === 'Locked').length;

    const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

    res.status(200).json(
      new ApiResponse(
        200,
        {
          employee,
          summary: {
            totalAssigned,
            completed,
            inProgress,
            overdue,
            locked,
            completionRate: `${completionRate}%`
          },
          assignments
        },
        'Employee report retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Instructor Dashboard Analytics
 * @route   GET /api/reports/instructor-dashboard
 * @access  Private (Instructor)
 */
const getInstructorDashboardReports = async (req, res, next) => {
  try {
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const instructorId = String(req.user.id || req.user._id);
    const now = new Date();

    const ownedTrainingsList = await prisma.training.findMany({
      where: {
        createdBy: instructorId,
        organizationId: orgId,
        status: { notIn: ['archived', 'deleted'] }
      },
      select: {
        id: true,
        title: true,
        status: true,
        isPublished: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    const ownedTrainings = withId(ownedTrainingsList);
    const trainingIds = ownedTrainings.map(t => t._id);

    const totalTrainings = ownedTrainings.length;

    const [rawAssignmentsList, instructorAssignmentsList] = await Promise.all([
      trainingIds.length > 0
        ? prisma.trainingAssignment.findMany({
            where: {
              organizationId: orgId,
              trainingId: { in: trainingIds }
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
              createdAt: true,
              employee: { select: { id: true, name: true, email: true, departmentId: true, jobRole: true, profilePicture: true } },
              training: { select: { id: true, title: true } }
            }
          })
        : Promise.resolve([]),
      prisma.assignment.findMany({
        where: trainingIds.length > 0
          ? { OR: [{ createdBy: instructorId }, { trainingId: { in: trainingIds } }] }
          : { createdBy: instructorId },
        select: { id: true, title: true, trainingId: true }
      })
    ]);

    const assignments = rawAssignmentsList.map(a => {
      const transformed = withId(a);
      if (transformed.employee) transformed.employeeId = transformed.employee;
      if (transformed.training) transformed.trainingId = transformed.training;
      return transformed;
    });

    const totalEnrolled = assignments.length;
    const assignmentIds = instructorAssignmentsList.map(a => a.id);

    const overdueCount = assignments.filter(a => a.status === 'Overdue' || (new Date(a.deadline) < now && a.status !== 'Completed')).length;

    const overdueEmployees = assignments
      .filter(a => a.status === 'Overdue' || (new Date(a.deadline) < now && a.status !== 'Completed'))
      .map(a => ({
        assignmentId: a._id,
        employeeName: a.employeeId ? a.employeeId.name : 'Unknown Employee',
        employeeEmail: a.employeeId ? a.employeeId.email : '',
        employeeAvatar: a.employeeId?.profilePicture,
        trainingTitle: a.trainingId ? a.trainingId.title : 'Training Course',
        deadline: a.deadline,
        daysOverdue: Math.max(1, Math.floor((now - new Date(a.deadline)) / (1000 * 60 * 60 * 24)))
      }));

    const [pendingReviewsCount, recentSubmissionsList] = await Promise.all([
      prisma.assignmentSubmission.count({
        where: {
          assignmentId: { in: assignmentIds },
          status: 'submitted'
        }
      }),
      prisma.assignmentSubmission.findMany({
        where: {
          assignmentId: { in: assignmentIds },
          status: 'submitted'
        },
        select: {
          id: true,
          assignmentId: true,
          employeeId: true,
          submittedAt: true,
          createdAt: true,
          assignment: { select: { id: true, title: true, trainingId: true } },
          employee: { select: { id: true, name: true, email: true, profilePicture: true } }
        },
        orderBy: { submittedAt: 'desc' },
        take: 5
      })
    ]);

    const recentSubmissions = recentSubmissionsList.map(s => {
      const transformed = withId(s);
      if (transformed.assignment) transformed.assignmentId = transformed.assignment;
      if (transformed.employee) transformed.employeeId = transformed.employee;
      return transformed;
    });

    const pendingSubmissions = recentSubmissions.map(sub => {
      const tr = ownedTrainings.find(t => t._id.toString() === sub.assignmentId?.trainingId?.toString());
      return {
        _id: sub._id,
        assignmentTitle: sub.assignmentId?.title || 'Assignment Submission',
        trainingTitle: tr?.title || 'Training Course',
        employeeName: sub.employeeId?.name || 'Employee',
        employeeEmail: sub.employeeId?.email || '',
        employeeAvatar: sub.employeeId?.profilePicture,
        submittedAt: sub.submittedAt || sub.createdAt
      };
    });

    const myTrainings = ownedTrainings.map(t => {
      const tAssigns = assignments.filter(a => a.trainingId && a.trainingId._id.toString() === t._id.toString());
      const tEnrolled = new Set(tAssigns.map(a => a.employeeId?._id?.toString()).filter(Boolean)).size;
      const tCompleted = tAssigns.filter(a => a.status === 'Completed').length;
      const tInProgress = tAssigns.filter(a => a.status === 'In Progress').length;
      const tPending = tAssigns.filter(a => a.status === 'Assigned' && (a.progressPercentage || 0) === 0).length;
      const tTotal = tAssigns.length;
      const completionRate = tTotal > 0 ? Math.round((tCompleted / tTotal) * 100) : 0;

      return {
        _id: t._id,
        title: t.title,
        status: t.status || (t.isPublished ? 'published' : 'draft'),
        enrolledCount: tEnrolled,
        totalAssigned: tTotal,
        completedCount: tCompleted,
        inProgressCount: tInProgress,
        pendingCount: tPending,
        completionRate
      };
    });

    const recentActivity = [];
    pendingSubmissions.forEach(sub => {
      recentActivity.push({
        id: `sub_${sub._id}`,
        type: 'submission',
        title: 'Assignment Submitted',
        description: `${sub.employeeName} submitted "${sub.assignmentTitle}" for ${sub.trainingTitle}`,
        timestamp: sub.submittedAt
      });
    });

    ownedTrainings.slice(0, 3).forEach(t => {
      recentActivity.push({
        id: `train_${t._id}`,
        type: 'creation',
        title: 'Training Created',
        description: `Created training course "${t.title}"`,
        timestamp: t.createdAt
      });
    });

    recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json(
      new ApiResponse(
        200,
        {
          stats: {
            createdTrainings: totalTrainings,
            totalTrainings: totalTrainings,
            totalEnrolled: totalEnrolled,
            activeEmployees: totalEnrolled,
            pendingReviews: pendingReviewsCount,
            overdueEnrollments: overdueCount
          },
          myTrainings,
          pendingSubmissions,
          overdueEmployees,
          recentActivity
        },
        'Instructor dashboard analytics retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Employee Personal Training Report & Stats
 * @route   GET /api/reports/my-report
 * @access  Private (Employee)
 */
const getMyReport = async (req, res, next) => {
  try {
    const employeeId = String(req.user.id || req.user._id);
    const orgId = String(req.user.organizationId.id || req.user.organizationId._id || req.user.organizationId);
    const now = new Date();

    const [employeeRecord, assignmentsList, quizAttemptsList, submissionsList] = await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          name: true,
          email: true,
          jobRole: true,
          department: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true, code: true } }
        }
      }),
      prisma.trainingAssignment.findMany({
        where: {
          employeeId,
          organizationId: orgId
        },
        include: {
          training: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailUrl: true,
              durationDays: true,
              isMandatory: true,
              createdBy: true,
              categoryId: true,
              category: { select: { id: true, name: true } },
              instructor: { select: { id: true, name: true, email: true, profilePicture: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.quizAttempt.findMany({
        where: { employeeId },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              passingScorePercent: true,
              trainingId: true,
              subSectionId: true
            }
          },
          answers: {
            orderBy: { questionIndex: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.assignmentSubmission.findMany({
        where: { employeeId },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              instructions: true,
              maxScore: true,
              trainingId: true,
              subSectionId: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      })
    ]);

    const employee = withId(employeeRecord);

    const assignments = assignmentsList.map(a => {
      const transformed = withId(a);
      if (transformed.training) {
        transformed.trainingId = transformed.training;
        if (transformed.training.category) transformed.trainingId.categoryId = transformed.training.category;
        if (transformed.training.instructor) transformed.trainingId.createdBy = transformed.training.instructor;
      }
      return transformed;
    });

    const quizAttempts = quizAttemptsList.map(q => {
      const transformed = withId(q);
      if (transformed.quiz) transformed.quizId = transformed.quiz;
      if (Array.isArray(transformed.answers)) {
        transformed.answers = withId(transformed.answers);
      }
      return transformed;
    });

    const assignmentSubmissions = submissionsList.map(s => {
      const transformed = withId(s);
      if (transformed.assignment) transformed.assignmentId = transformed.assignment;
      return transformed;
    });

    const isOverdue = a => a.status === 'Overdue' || (new Date(a.deadline) < now && a.status !== 'Completed');

    const totalAssigned = assignments.length;
    const completedAssignments = assignments.filter(a => a.status === 'Completed' || (a.progressPercentage || 0) === 100).length;
    const overdueAssignments = assignments.filter(isOverdue).length;
    const inProgressAssignments = assignments.filter(a => (a.status === 'In Progress' || (a.progressPercentage || 0) > 0) && a.status !== 'Completed' && !isOverdue(a)).length;
    const notStartedAssignments = Math.max(0, totalAssigned - completedAssignments - inProgressAssignments - overdueAssignments);

    const overallProgress = totalAssigned > 0
      ? Math.round(assignments.reduce((sum, a) => sum + (a.progressPercentage || 0), 0) / totalAssigned)
      : 0;

    const totalQuizAttempts = quizAttempts.length;
    const quizzesPassed = quizAttempts.filter(q => q.passed).length;
    const quizzesFailed = quizAttempts.filter(q => !q.passed).length;
    const averageQuizScore = totalQuizAttempts > 0
      ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.percentage || 0), 0) / totalQuizAttempts)
      : 0;

    const bestQuizScore = totalQuizAttempts > 0
      ? Math.max(...quizAttempts.map(q => q.percentage || 0))
      : null;

    const transcript = assignments.map(a => {
      const t = a.trainingId;
      const isOverdue = a.status === 'Overdue' || (new Date(a.deadline) < now && a.status !== 'Completed');

      let displayStatus = 'Not Started';
      if (a.status === 'Completed' || (a.progressPercentage || 0) === 100) displayStatus = 'Completed';
      else if (isOverdue) displayStatus = 'Overdue';
      else if (a.status === 'In Progress' || (a.progressPercentage || 0) > 0) displayStatus = 'In Progress';

      const tId = t ? (t._id || t.id || t).toString() : null;

      const trainingQuizAttempts = quizAttempts.filter(q => {
        if (!q.quizId || !tId) return false;
        const qTrgId = q.quizId.trainingId ? (q.quizId.trainingId._id || q.quizId.trainingId.id || q.quizId.trainingId).toString() : null;
        return qTrgId === tId;
      });

      let quizScoreDisplay = 'N/A';
      if (trainingQuizAttempts.length > 0) {
        const bestScore = Math.max(...trainingQuizAttempts.map(q => q.percentage || 0));
        quizScoreDisplay = `${bestScore}%`;
      }

      const trainingSubmissions = assignmentSubmissions.filter(s => {
        if (!s.assignmentId || !tId) return false;
        const sTrgId = s.assignmentId.trainingId ? (s.assignmentId.trainingId._id || s.assignmentId.trainingId.id || s.assignmentId.trainingId).toString() : null;
        return sTrgId === tId;
      });

      let assignmentStatusDisplay = 'N/A';
      if (trainingSubmissions.length > 0 && trainingSubmissions[0]) {
        assignmentStatusDisplay = trainingSubmissions[0].status === 'reviewed' ? 'Reviewed' : 'Submitted';
      }

      return {
        _id: a._id,
        trainingId: t ? t._id : null,
        title: t ? t.title : 'Training Course',
        thumbnailUrl: t ? t.thumbnailUrl : '',
        description: t ? t.description : '',
        category: t?.categoryId?.name || 'General Training',
        instructorName: t?.createdBy?.name || 'Instructor',
        instructorEmail: t?.createdBy?.email || '',
        assignedDate: a.assignedDate || a.createdAt,
        deadline: a.deadline,
        completedDate: a.completedDate,
        progressPercentage: a.progressPercentage || 0,
        status: displayStatus,
        quizScore: quizScoreDisplay,
        assignmentStatus: assignmentStatusDisplay
      };
    });

    const formattedQuizAttempts = quizAttempts.map(att => {
      const quizObj = att.quizId;
      const questionsList = (quizObj && Array.isArray(quizObj.questions)) ? quizObj.questions : [];

      const answers = (att.answers || []).map((ans, idx) => {
        const qIdx = ans.questionIndex !== undefined ? ans.questionIndex : idx;
        const qInQuiz = Array.isArray(questionsList) ? questionsList[qIdx] : null;

        const qText = ans.questionText || (qInQuiz ? qInQuiz.questionText : `Question ${idx + 1}`);
        const opts = (ans.options && ans.options.length > 0) ? ans.options : (qInQuiz ? qInQuiz.options : []);

        let selOptIdx = ans.selectedOptionIndex;
        if (selOptIdx === undefined && ans.selectedOptionIdx !== undefined) {
          selOptIdx = ans.selectedOptionIdx;
        }

        let selAnsText = ans.selectedAnswerText || '';
        if (!selAnsText && selOptIdx !== null && selOptIdx !== undefined && opts && opts[selOptIdx]) {
          selAnsText = opts[selOptIdx];
        }

        let corrAnsIdx = ans.correctAnswerIndex;
        if (corrAnsIdx === undefined && qInQuiz) {
          corrAnsIdx = qInQuiz.correctAnswerIndex;
        }

        let corrAnsText = ans.correctAnswerText || '';
        if (!corrAnsText && corrAnsIdx !== null && corrAnsIdx !== undefined && opts && opts[corrAnsIdx]) {
          corrAnsText = opts[corrAnsIdx];
        }

        let status = 'incorrect';
        let dataUnavailable = false;

        if (ans.isCorrect === true) {
          status = 'correct';
        } else if (selOptIdx === null || selOptIdx === undefined || selOptIdx < 0) {
          if (!selAnsText && (!opts || opts.length === 0)) {
            status = 'data_unavailable';
            dataUnavailable = true;
          } else {
            status = 'not_answered';
          }
        } else {
          status = 'incorrect';
        }

        return {
          questionIndex: qIdx,
          questionText: qText,
          selectedOptionIndex: selOptIdx,
          selectedAnswerText: selAnsText,
          correctAnswerIndex: corrAnsIdx,
          correctAnswerText: corrAnsText,
          options: opts,
          isCorrect: Boolean(ans.isCorrect),
          status,
          dataUnavailable
        };
      });

      return {
        _id: att._id,
        quizId: att.quizId?._id,
        quizTitle: att.quizId?.title || 'Section Quiz',
        attemptNumber: att.attemptNumber || 1,
        totalScore: att.totalScore,
        maxScore: att.maxScore,
        percentage: att.percentage,
        passingScorePercent: att.passingScorePercent || att.quizId?.passingScorePercent || 70,
        passed: att.passed,
        createdAt: att.createdAt,
        answers
      };
    });

    const formattedAssignmentSubmissions = assignmentSubmissions.map(sub => ({
      _id: sub._id,
      assignmentId: sub.assignmentId?._id,
      assignmentTitle: sub.assignmentId?.title || 'Project Assignment',
      instructions: sub.assignmentId?.instructions || '',
      maxScore: sub.assignmentId?.maxScore || 100,
      submissionType: sub.submissionType,
      githubUrl: sub.githubUrl || '',
      fileUrl: sub.fileUrl || '',
      status: sub.status,
      submittedAt: sub.submittedAt || sub.createdAt,
      score: sub.score,
      feedback: sub.feedback
    }));

    res.status(200).json(
      new ApiResponse(
        200,
        {
          employee: {
            id: employee ? employee._id : req.user._id,
            name: employee ? employee.name : req.user.name,
            email: employee ? employee.email : req.user.email,
            jobRole: employee?.jobRole || 'Employee',
            department: employee?.department?.name || employee?.departmentName || 'Unassigned',
            organization: employee?.organization?.name || employee?.orgName || 'Organization'
          },
          overview: {
            totalAssignments: totalAssigned,
            totalAssigned,
            completedAssignments,
            completedCourses: completedAssignments,
            inProgressAssignments,
            notStartedAssignments,
            overdueAssignments,
            overallProgress,
            averageQuizScore,
            totalQuizAttempts,
            quizzesPassed,
            quizzesFailed,
            bestQuizScore,
            totalAssignmentsSubmitted: assignmentSubmissions.length
          },
          assignments: transcript,
          quizAttempts: formattedQuizAttempts,
          assignmentSubmissions: formattedAssignmentSubmissions
        },
        'Employee personal report retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFullOrgReport,
  getAdminDashboardReports,
  getEmployeeReport,
  getInstructorDashboardReports,
  getMyReport
};
